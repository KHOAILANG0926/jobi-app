#!/usr/bin/env python3
"""Interactive server-only Muaban login; no credentials in GitHub or logs."""
import fcntl
import getpass
import os
from pathlib import Path
import re
import sys
import time

TARGET = 'https://muaban.net/viec-lam/ban-hang-tp-bac-ninh/tefal-tuyen-pg-ban-hang-gia-dung-id71286061'
EXPECTED_AD_PHONE = '0337152446'  # Advertised number already shown by Lee.


def phone_valid(value):
    return re.fullmatch(r'0[35789][0-9]{8}', value) is not None


def private_dir(path):
    if path.is_symlink():
        raise RuntimeError('SYMLINK_REFUSED')
    path.mkdir(mode=0o700, parents=True, exist_ok=True)
    if path.stat().st_uid != os.getuid():
        raise RuntimeError('PROFILE_OWNER_MISMATCH')
    path.chmod(0o700)


def visible(locator):
    return [locator.nth(i) for i in range(locator.count()) if locator.nth(i).is_visible()]


def ad_phone_visible(page):
    # Read the public ad phone only, never an input value or saved cookies.
    for item in visible(page.locator('a[href^="tel:"]')):
        if re.sub(r'\D', '', item.get_attribute('href') or '') == EXPECTED_AD_PHONE:
            return True
    return bool(re.search(r'0337[ .-]?152[ .-]?446', page.locator('body').inner_text()))


def submit(page):
    for label in ('Đăng nhập', 'Xác nhận', 'Tiếp tục'):
        items = visible(page.get_by_role('button', name=label, exact=True))
        if items:
            items[-1].click(timeout=10000)
            return
    raise RuntimeError('LOGIN_SUBMIT_BUTTON_NOT_FOUND')


def main():
    if os.getuid() == 0:
        raise RuntimeError('RUN_AS_CRAWLER_RUNNER_NOT_ROOT')
    from playwright.sync_api import sync_playwright
    base = Path.home() / '.jobi-muaban'
    private_dir(base)
    profile = base / 'profile'
    private_dir(profile)
    with (base / 'login.lock').open('w') as lock:
        os.chmod(lock.name, 0o600)
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        with sync_playwright() as pw:
            context = pw.chromium.launch_persistent_context(
                str(profile), headless=True, chromium_sandbox=True,
                locale='vi-VN', viewport={'width': 1280, 'height': 900},
            )
            try:
                page = context.pages[0] if context.pages else context.new_page()
                response = page.goto(TARGET, wait_until='domcontentloaded', timeout=45000)
                if response is None or response.status != 200:
                    raise RuntimeError('PUBLIC_AD_NOT_AVAILABLE')
                if ad_phone_visible(page):
                    print('LOGIN_ALREADY_VALID: public ad phone visible.')
                    return
                buttons = visible(page.get_by_text(re.compile(r'Bấm để hiện số|^Hiện số$', re.I)))
                if not buttons:
                    raise RuntimeError('PHONE_REVEAL_BUTTON_NOT_FOUND')
                buttons[0].click(timeout=10000)
                field = page.locator('input[name="phone"]')
                field.wait_for(state='visible', timeout=15000)
                phone = getpass.getpass('Muaban login phone (10 digits; hidden): ').strip()
                if not phone_valid(phone):
                    raise RuntimeError('PHONE_MUST_BE_10_VIETNAM_MOBILE_DIGITS')
                field.fill(phone)
                page.get_by_role('button', name='Tiếp tục', exact=True).click(timeout=10000)
                del phone
                entered_secret = False
                revealed_after_login = False
                deadline = time.monotonic() + 90
                while time.monotonic() < deadline:
                    page.wait_for_timeout(500)
                    if ad_phone_visible(page):
                        print('LOGIN_SAVED: server profile saved; public ad phone confirmed.')
                        return
                    # No automatic account creation, terms acceptance or CAPTCHA solving.
                    headings = page.get_by_role('heading').all_text_contents()
                    if any(re.search(r'Tạo tài khoản|Đăng ký tài khoản', h, re.I) for h in headings):
                        raise RuntimeError('NEW_ACCOUNT_REGISTRATION_REQUIRES_USER_REVIEW')
                    if visible(page.locator('iframe[src*="recaptcha"][title*="challenge"], iframe[src*="hcaptcha"]')):
                        raise RuntimeError('VISIBLE_SECURITY_CHALLENGE_REQUIRES_USER')
                    password = visible(page.locator('input[type="password"]'))
                    otp = visible(page.locator('input[autocomplete="one-time-code"], input[name*="otp" i], input[name*="code" i], input[inputmode="numeric"][maxlength="1"]'))
                    if not entered_secret and (password or otp):
                        target = password if password else otp
                        secret = getpass.getpass('Muaban password (hidden): ' if password else 'SMS verification code (hidden): ')
                        if not secret:
                            raise RuntimeError('EMPTY_LOGIN_SECRET')
                        if len(target) > 1 and all(x.get_attribute('maxlength') == '1' for x in target):
                            if len(secret) != len(target):
                                raise RuntimeError('OTP_LENGTH_MISMATCH')
                            for item, char in zip(target, secret):
                                item.fill(char)
                        else:
                            target[0].fill(secret)
                        submit(page)
                        del secret
                        entered_secret = True
                        deadline = time.monotonic() + 90
                    # After successful login the ad may need one fresh reveal click.
                    if entered_secret and not revealed_after_login and not visible(page.locator('input[name="phone"], input[type="password"], input[autocomplete="one-time-code"]')):
                        reveal = visible(page.get_by_text(re.compile(r'Bấm để hiện số|^Hiện số$', re.I)))
                        if reveal:
                            reveal[0].click(timeout=10000)
                            revealed_after_login = True
                raise RuntimeError('LOGIN_NOT_CONFIRMED_WITHIN_90_SECONDS')
            finally:
                context.close()


if __name__ == '__main__':
    try:
        if sys.argv[1:] == ['--check']:
            if os.getuid() == 0:
                raise RuntimeError('RUN_AS_CRAWLER_RUNNER_NOT_ROOT')
            from playwright.sync_api import sync_playwright
            with sync_playwright() as pw:
                if not Path(pw.chromium.executable_path).is_file():
                    raise RuntimeError('BROWSER_EXECUTABLE_MISSING')
            print('LOGIN_SCRIPT_READY: non-root account and browser executable confirmed.')
        elif sys.argv[1:]:
            raise RuntimeError('UNKNOWN_ARGUMENT')
        else:
            main()
    except KeyboardInterrupt:
        print('\nLOGIN_CANCELLED')
        sys.exit(130)
    except Exception as exc:
        # Never print exception details that could contain a credential or form value.
        reason = str(exc) if type(exc) is RuntimeError else type(exc).__name__
        print('LOGIN_NOT_CONFIRMED: ' + reason)
        sys.exit(1)
