# Timezones in renewal, overdue and customer support

These conventions apply to renewal/rental API screens, overdue features, customer support, and their dedicated staff panels. Other flows retain their existing implementation.

- Business calendars, opening hours, date filters and displayed timestamps use `Asia/Ho_Chi_Minh`, independent of the browser or CI host timezone.
- API instants remain ISO timestamps with an explicit offset (`Z` or `+07:00`). Do not shift an instant before sending it to the API.
- Calendar dates remain `YYYY-MM-DD`. A date is not a UTC timestamp; compare date strings or use the shared calendar helpers.
- Use `src/utils/vietnamTime.ts` for Vietnam date/form values, parsing offset-free ISO values, and calendar component getters/setters. These use UTC+7 without DST for the modern business dates supported by this application.
- Format Date values with `timeZone: VIETNAM_TIME_ZONE`; `vi-VN` alone selects a locale, not a timezone.
- `datetime-local` values mean Vietnam local time. Convert with `parseVietnamDate(value).toISOString()`; use `vietnamDateTimeInput(instant)` to populate a form. Renewal appointment input additionally validates nonexistent dates through `vietnamLocalInstant`.
- UTC arithmetic for pure calendar dates and API date validation is intentional. Keep explicit UTC accessors in those algorithms.

Test these features under both `UTC` and `Asia/Ho_Chi_Minh`. Expected business dates must be fixed values, never computed from the host's local timezone. The broad timezone changes and global CI matrix were reverted; reservation/check-in and generic staff date tests retain their original timezone dependence.
