var babel = require('@babel/core')
var presetEnv = require('@babel/preset-env')
var splicer = require('labeled-stream-splicer')
var moduleDeps = require('module-deps')
var pack = require('browser-pack')
var through = require('through2')
var defined = require('defined')
var outpipe = require('outpipe')

var cache = {}
var fileCache = {}
var packageCache = {}

function tee (stream) {
  return through.obj(ondata, onend)
  function ondata (row, enc, cb) {
    stream.write(row)
    cb(null, row)
  }
  function onend (cb) {
    stream.on('close', cb)
    stream.end()
  }
}

module.exports = function apply (b, opts) {
  opts = opts || {}

  var compact = defined(opts.compact, true)
  var debug = b._options.debug

  var babelOpts = Object.assign({}, opts, {
    // ONLY use preset-env.
    babelrc: false,
    presets: [
      [presetEnv, { useBuiltIns: 'entry' }]
    ],

    // Add sourcemaps to the resulting `.code` as a comment
    sourceMaps: debug ? 'inline' : false,

    // Compact output is faster.
    compact: compact,
    comments: !compact
  })
  delete babelOpts._
  delete babelOpts.out

  b.on('reset', addHooks)
  addHooks()

  function addHooks () {
    var legacyPipeline = createLegacyPipeline(babelOpts, b)
    // Emit event so folks can hook into the `'wrap'` phase, eg. for minification.
    b.emit('legacy.pipeline', legacyPipeline)

    b.pipeline.get('pack').unshift( tee(legacyPipeline) )

    var out = opts.out
    if (typeof out === 'string') out = outpipe(out)
    legacyPipeline.pipe(out)
    legacyPipeline.on('error', console.error)
  }
}

function createLegacyPipeline (opts, b) {
  var first = true
  var polyfills = []

  var stream = splicer.obj([
    'transform', [ through.obj(onwrite, onend) ],
    'pack', [ pack(Object.assign({}, b._options, { raw: true })) ],
    'wrap', []
  ])
  return stream

  function onwrite (row, enc, cb) {
    console.error('legacy', row.id)
    var src = row.source
    var wasFirst = first
    if (first) {
      src = 'require("@babel/polyfill"); // added by legacy-bundle\n' + src
      first = false
    }
    babel.transform(src, opts, function (err, result) {
      if (err) return cb(err)
      if (wasFirst) {
        // Match polyfills that were added.
        row.source = result.code.replace(/\brequire\("(core-js\/.*?|regenerator-runtime\/.*?|@babel\/polyfill\/.*?)"\);/g, function (input, path) {
          stream.emit('polyfill', path)
          polyfills.push(path)
          return ' '.repeat(input.length)
        })
      }
      cb(null, row)
    })
  }

  function onend (cb) {
    if (polyfills.length === 0) {
      return cb()
    }

    var self = this
    // collect polyfill dependencies.
    var pdeps = moduleDeps({
      basedir: __dirname,
      transformKey: false,
      cache: cache,
      fileCache: fileCache,
      packageCache: packageCache
    })

    pdeps.on('data', function (row) {
      self.push(row)
    })
    pdeps.on('error', cb)
    pdeps.on('close', cb)

    for (var i = 0; i < polyfills.length; i++) {
      pdeps.write({
        id: 'pf' + i, //polyfill $i
        file: polyfills[i],
        entry: true,
        order: -polyfills.length + i
      })
    }
    pdeps.end()
  }
}
