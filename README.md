# Banqi Online 暗棋

Two-player Banqi (Chinese dark chess, Taiwan rules) in the browser. No server and no sign-up: the two browsers talk peer-to-peer through [PeerJS](https://peerjs.com/).

- Create a game and send the link. Whoever creates the game hosts it and keeps the game state; refreshing either side reconnects.
- Also has a same-device mode.
- Rules live in `logic.js`; run `node test/logic.test.js` to test them.
