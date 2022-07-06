# wikirace
a chrome extension for Wikipedia racing
## disclaimer
this thing was written horribly and probably has about 20 RCE vulns, only use it with people you trust
## use
1. download and unzip the latest release
2. go to `chrome://extensions`
3. click load unpacked
4. select the wikirace folder
5. click the extension icon to open the extension page (you can pin the icon for easier access)
6. host or join a game, hopefully things are self-explanatory
## known issues
- disambig blocking doesn't work
## things i want to add later
- being able to see the path of others, you can already kinda do this by
putting `playerResults.map(p => p.username + ": " + p.path.toString())` in the devtools
console in the postrace screen
