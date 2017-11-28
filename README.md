# legacy-bundle

create an additional browserify bundle for legacy browsers (ES5)

inspired by:
https://philipwalton.com/articles/deploying-es2015-code-in-production-today/

[![npm][npm-image]][npm-url]
[![travis][travis-image]][travis-url]
[![standard][standard-image]][standard-url]

[npm-image]: https://img.shields.io/npm/v/legacy-bundle.svg?style=flat-square
[npm-url]: https://www.npmjs.com/package/legacy-bundle
[travis-image]: https://img.shields.io/travis/goto-bus-stop/legacy-bundle.svg?style=flat-square
[travis-url]: https://travis-ci.org/goto-bus-stop/legacy-bundle
[standard-image]: https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat-square
[standard-url]: http://npm.im/standard

## Install

```
npm install legacy-bundle
```

## Usage

```
browserify app.js \
  -p [ legacy-bundle --out ./bundle.legacy.js ] \
  > bundle.js
```

This will run Babel with [preset-env](https://www.npmjs.com/package/@babel/preset-env) on the bundle, and output the compiled version to `bundle.legacy.js`.
`bundle.js` will contain the original code, not compiled by Babel.

```html
<script type="module" src="bundle.js"></script>
<script nomodule src="bundle.legacy.js"></script>
```

`--out` is an [outpipe](https://npmjs.com/package/outpipe), so you can pass it through other shell commands, like [uglify-js](https://npmjs.com/package/uglify-js):
Using the Node API, the `out:` option can also be a writable stream.

```js
browserify('./app.js')
  .plugin('legacy-bundle', { out: fs.createWriteStream('/tmp/legacy.js') })
```

```
browserify app.js \
  -p [ legacy-bundle --out 'uglifyjs -cm > ./bundle.legacy.js' ] \
  > bundle.js
```

legacy-bundle outputs a semi-compressed bundle, compiled with babel's `--compact` option.
If you need formatted source code for some reason, pass the `--no-compact` flag on the CLI or the `compact: false` option with the Node API.
Note that outputting formatted code is a bit slower. Since you'll most likely minify the bundle afterwards, it's compacted by default.

## License

[Apache-2.0](LICENSE.md)
