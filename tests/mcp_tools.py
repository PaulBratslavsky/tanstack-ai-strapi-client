"""Gate 3.5 — asserts MCP tools actually FIRE, not that the answer sounds right."""
import sys, time
from playwright.sync_api import sync_playwright

URL = "http://localhost:3020"
PROMPT = sys.argv[1] if len(sys.argv) > 1 else "What articles do I have, and what categories are they in?"
PROVIDER = sys.argv[2] if len(sys.argv) > 2 else None

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    errors = []
    page.on("console", lambda m: errors.append(f"[{m.type}] {m.text}") if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(f"[pageerror] {e}"))

    page.goto(URL, wait_until="domcontentloaded")
    page.wait_for_selector('input[placeholder="Message..."]', timeout=30000)
    page.wait_for_function(
        "() => { const hs=[...document.querySelectorAll('header')]; const h=hs.find(x=>x.innerText.includes('TanStack AI')); return h && !h.innerText.includes('checking MCP'); }",
        timeout=30000,
    )
    print("=== status bar ===")
    print(page.locator("header").filter(has_text="TanStack AI").first.inner_text().replace("\n", " | "))

    if PROVIDER:
        page.locator("select").first.select_option(PROVIDER)
        print(f"=== provider: {PROVIDER} ===")

    box = page.locator('input[placeholder="Message..."]')
    box.click()
    box.press_sequentially(PROMPT, delay=5)
    page.wait_for_selector('button[type="submit"]:not([disabled])', timeout=10000)
    box.press("Enter")
    start = time.time()

    # Tool blocks are the amber font-mono divs rendered by MessageList's Part().
    tool_blocks = page.locator("div.font-mono, details.font-mono")
    assistant = page.locator("div.mr-auto")

    # Completion signal: isLoading flips false, so the Stop button is replaced
    # by Send. A "text stopped changing" heuristic fires prematurely on
    # reasoning models that emit a long thinking block before any output.
    deadline = time.time() + 300
    last = ""
    while time.time() < deadline:
        try:
            cur = assistant.last.inner_text() if assistant.count() else ""
        except Exception:
            cur = last
        if cur:
            last = cur
        done = page.locator('button[type="submit"]').count() > 0
        if done and time.time() > start + 3:
            break
        time.sleep(0.5)
    print(f"=== wall_clock={round(time.time() - start)}s ===")

    n = tool_blocks.count()
    print(f"=== tool blocks rendered: {n} ===")
    names = []
    for i in range(min(n, 12)):
        t = tool_blocks.nth(i).inner_text().strip().splitlines()[0]
        names.append(t)
        print("  ", t)

    print("=== final answer ===")
    print(last[:700])

    err = page.locator("div.border-red-700\\/60")
    if err.count():
        print("=== ERROR BANNER ==="); print(err.first.inner_text()[:400])
    if errors:
        print("=== CONSOLE ERRORS ===")
        for e in errors[:8]: print("  ", e[:250])

    print("TOOLS_FIRED" if n > 0 else "NO_TOOLS_FIRED")
    page.screenshot(path="/tmp/mcp_tools.png", full_page=True)
    browser.close()
