const crypto = require('crypto');

const generate = () => crypto.randomBytes(32).toString('hex');

module.exports = { generate };
