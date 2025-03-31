const { hash } = require('bcrypt');
hash('admin123', 12).then(console.log);