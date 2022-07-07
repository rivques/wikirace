# wikirace
a chrome (and someties firefox) extension for Wikipedia racing
## disclaimer
this thing was written horribly and probably has about 20 RCE vulns, only use it with people you trust
## use (chrome)
1. download and unzip the latest release
2. go to `chrome://extensions`
3. click load unpacked
4. select the wikirace folder
5. click the extension (letter W) icon in the puzzle piece menu to open the extension page (you can pin the icon for easier access)
6. host or join a game, hopefully things are self-explanatory
## use (firefox)
1. download and unzip the latest release
2. go to `about:debugging`
3. click load temporary extension
4. select the manifest.json file inside the wikirace folder
5. click the extension (puzzle-piece) icon in the toolbar to open the extension page
6. host or join a game, hopefully things are self-explanatory
## known issues
- disambig blocking doesn't work
## things i want to add later
- being able to see the path of others, you can already kinda do this by
putting `playerResults.map(p => p.username + ": " + p.path.toString())` in the devtools
console in the postrace screen
