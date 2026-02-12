Delete some routes/components?
Test new user/household/store scan/items/list

The WiFi adapter is often the first thing to suffer from undervoltage.
WiFi power management - Raspberry Pi OS sometimes enables WiFi power saving, which can cause the adapter to sleep and not wake up properly. You can disable it:
bashsudo iwconfig wlan0 power off
To make it permanent, add this to /etc/rc.local (before exit 0):
bash/sbin/iwconfig wlan0 power off

remove route.ts bad code smell where exception text is tested for strings

---

background job to clean up the database:

- delete stale collaboration invitations

eslint.config.js for the monorepo?
ionic.config.json?
More transition CSS effects

"next item" hey Google integration
RECIPES/MEAL PLANNING TAB
