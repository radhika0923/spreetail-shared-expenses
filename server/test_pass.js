const bcrypt = require('bcryptjs');

const hash = '$2b$10$7oCe2nvnsvxSHBGoQKNZAOAUAEquaYVeVsvAqeAs8UU/UGH69Saui';
const passwordsToTest = [
  'password', 'password123', 'Anisha', 'anisha', 'Anisha123', 'anisha123',
  '123456', 'test', 'Test', 'admin', 'Admin', '12345678'
];

async function test() {
  for (const pw of passwordsToTest) {
    const match = await bcrypt.compare(pw, hash);
    if (match) {
      console.log('Match found:', pw);
      return;
    }
  }
  console.log('No match found');
}

test();
