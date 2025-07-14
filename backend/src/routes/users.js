/**
 * Placeholder users route
 * This is a stub to prevent server crash due to missing file.
 * You can implement user management APIs here.
 */

const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({ message: 'Users route placeholder' });
});

module.exports = router;
