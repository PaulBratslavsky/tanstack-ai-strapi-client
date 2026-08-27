"""Drives the chat UI and asserts the reply actually STREAMS (grows over time)."""
import sys, time
from playwright.sync_api import sync_playwright

URL = "http://localhost:3000"
PROMPT = sys.argv[1] if len(sys.argv) > 1 else "Explain what MCP is in two sentences."
PROVIDER = sys.argv[2] if len(sys.argv) > 2 else None

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    errors = []
    page.on("console", lambda m: errors.append(f"[{m.type}] {m.text}") if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(f"[pageerror] {e}"))

    # NOT networkidle: Vite dev keeps an HMR websocket open, so the network is
    # never idle and the wait times out after 30s.
    page.goto(URL, wait_until="domcontentloaded")
    page.wait_for_selector('input[placeholder="Message..."]', timeout=30000)

    # Wait for hydration before typing: filling a controlled input before React
    # attaches its handlers sets the DOM value but not component state, leaving
    # the Send button disabled. The MCP status strip resolving from
    # "checking MCP..." proves hydration ran AND that getMcpStatusFn round-trips.
    page.wait_for_function(
        "() => { const h = document.querySelector('header'); return h && !h.innerText.includes('checking MCP'); }",
        timeout=30000,
    )

    print("=== MCP status strip ===")
    print(page.locator("header").first.inner_text().replace("\n", " | "))

    if PROVIDER:
        page.locator("select").select_option(PROVIDER)
        print(f"=== provider set to {PROVIDER} ===")

    box = page.locator('input[placeholder="Message..."]')
    box.click()
    box.press_sequentially(PROMPT, delay=5)
    page.wait_for_selector('button[type="submit"]:not([disabled])', timeout=10000)
    # Submit with Enter, not a click: the TanStack Devtools floating trigger
    # overlays the Send button and intercepts pointer events.
    box.press("Enter")

    # Sample the assistant bubble over time to prove incremental streaming.
    assistant = page.locator("div.mr-auto")
    samples, deadline = [], time.time() + 90
    while time.time() < deadline:
        try:
            if assistant.count() > 0:
                t = assistant.last.inner_text()
                if not samples or samples[-1][1] != t:
                    samples.append((round(time.time() % 1000, 1), t))
        except Exception:
            pass
        # Stop once the Send button returns (isLoading false) and we have text.
        if samples and page.locator('button[type="submit"]').count() > 0:
            time.sleep(1.0)
            try:
                if assistant.count() and assistant.last.inner_text() == samples[-1][1]:
                    break
            except Exception:
                break
        time.sleep(0.4)

    print(f"=== distinct render states: {len(samples)} ===")
    for ts, s in samples[:3]:
        print(f"  early: {s[:70]!r}")
    if samples:
        print(f"  final: {samples[-1][1][:400]!r}")
        print(f"  final_len={len(samples[-1][1])}")
    print("STREAMED" if len(samples) > 2 else "NOT_STREAMED (arrived in one chunk or failed)")

    err_txt = page.locator("div.border-red-700\\/60")
    if err_txt.count() > 0:
        print("=== UI ERROR BANNER ===")
        print(err_txt.first.inner_text()[:500])

    if errors:
        print("=== CONSOLE ERRORS ===")
        for e in errors[:10]:
            print(" ", e[:300])

    page.screenshot(path="/tmp/chat_test.png", full_page=True)
    browser.close()
