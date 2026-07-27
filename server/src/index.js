import 'dotenv/config';
import app from './app.js';

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`\n  Waste Picker API listening on http://localhost:${PORT}`);
  console.log(`  Android emulator should call http://10.0.2.2:${PORT}/api/\n`);
});
