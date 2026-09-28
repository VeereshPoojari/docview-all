import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import postcss from 'rollup-plugin-postcss';

const external = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'vue',
  '@angular/core',
  '@angular/common',
  'react-native'
];

const createFrameworkConfig = (input, outputDir, banner = undefined) => ({
  input,
  output: [
    {
      file: `dist/${outputDir}/index.js`,
      format: 'cjs',
      sourcemap: true,
      exports: 'named',
      banner
    },
    {
      file: `dist/${outputDir}/index.esm.js`,
      format: 'esm',
      sourcemap: true,
      banner
    }
  ],
  plugins: [
    resolve({ extensions: ['.js', '.jsx', '.ts'] }),
    commonjs(),
    terser()
  ],
  external: (id) => external.some((ext) => id === ext || id.startsWith(`${ext}/`))
});

export default [
  // 1. Core Universal Engine (ESM, CJS, and CDN UMD)
  {
    input: 'src/index.js',
    output: [
      {
        file: 'dist/index.esm.js',
        format: 'esm',
        sourcemap: true
      },
      {
        file: 'dist/index.js',
        format: 'cjs',
        sourcemap: true,
        exports: 'named'
      },
      {
        file: 'dist/index.umd.js',
        format: 'umd',
        name: 'DocViewerAll',
        sourcemap: true,
        exports: 'named'
      }
    ],
    plugins: [
      resolve(),
      commonjs(),
      terser()
    ]
  },

  // 2. React Wrapper (with 'use client'; for Next.js App Router)
  createFrameworkConfig('src/react/index.js', 'react', "'use client';"),

  // 3. Vue 3 Wrapper
  createFrameworkConfig('src/vue/index.js', 'vue'),

  // 4. Angular Wrapper
  createFrameworkConfig('src/angular/index.js', 'angular'),

  // 5. React Native Wrapper
  createFrameworkConfig('src/react-native/index.js', 'react-native'),

  // 6. CSS Distribution
  {
    input: 'src/styles/docview-all.css',
    output: {
      file: 'dist/docview-all.css'
    },
    plugins: [
      postcss({
        extract: true,
        minimize: true
      })
    ]
  }
];
