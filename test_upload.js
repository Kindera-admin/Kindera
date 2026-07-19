const fs = require('fs');
async function test() {
  const FormData = require('formdata-node').FormData;
  const { fileFromPath } = require('formdata-node/file-from-path');
  const fetch = require('node-fetch');

  const form = new FormData();
  fs.writeFileSync('test_logo.png', 'fake image data');
  form.append('file', await fileFromPath('test_logo.png'));
  form.append('folder', 'kindera/ngo-partners');

  try {
    const res = await fetch('http://localhost:3000/api/upload', {
      method: 'POST',
      body: form
    });
    console.log("Status:", res.status);
    console.log("Body:", await res.text());
  } catch(e) {
    console.error(e);
  }
}
test();
