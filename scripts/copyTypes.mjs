import fs from 'fs';

// Ensure dist and framework subdirectories exist
['dist/types', 'dist/react', 'dist/vue', 'dist/angular', 'dist/react-native'].forEach(dir => {
  fs.mkdirSync(dir, { recursive: true });
});

// Copy TypeScript declarations
const typeFiles = [
  ['src/types/index.d.ts', 'dist/types/index.d.ts'],
  ['src/react/index.d.ts', 'dist/react/index.d.ts'],
  ['src/vue/index.d.ts', 'dist/vue/index.d.ts'],
  ['src/angular/index.d.ts', 'dist/angular/index.d.ts'],
  ['src/react-native/index.d.ts', 'dist/react-native/index.d.ts']
];

typeFiles.forEach(([src, dest]) => {
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
  }
});

console.log('✓ TypeScript declaration files copied to dist/');
