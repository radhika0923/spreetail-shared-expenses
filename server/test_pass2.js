const bcrypt = require('bcryptjs');

const hash = '$2b$10$7oCe2nvnsvxSHBGoQKNZAOAUAEquaYVeVsvAqeAs8UU/UGH69Saui';
const passwordsToTest = [
  'secret', 'hello', '1234', '12345', 'qwerty', '111111', 'password1234', 'admin123', 'admin1234', 'root', 'anisha', 'Anisha', 'ANISHA', 'anisha12', 'anisha@123'
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
