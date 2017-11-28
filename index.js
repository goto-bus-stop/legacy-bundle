var babel = require('@babel/core')
var presetEnv = require('@babel/preset-env')
var splicer = require('labeled-stream-splicer')
var through = require('through2')
var defined = require('defined')
var outpipe = require('outpipe')
var pump = require('pump')

function tee (stream) {
  return through(ondata, onend)
  function ondata (chunk, enc, cb) {
    stream.write(chunk)
    cb(null, chunk)
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
    presets: [presetEnv],

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
    var legacyPipeline = createLegacyPipeline(babelOpts)
    // Emit event so folks can hook into the `'wrap'` phase, eg. for minification.
    b.emit('legacy.pipeline', legacyPipeline)

    // Push to the pack label, so this happens _after_ browser-pack but before minification
    // (could maybe also unshift it to 'wrap', not sure if that will work with what people are doing in 'wrap')
    b.pipeline.get('pack').push( tee(legacyPipeline) )

    var out = opts.out
    if (typeof out === 'string') out = outpipe(out)
    pump(legacyPipeline, out)
  }
}

function createLegacyPipeline (opts) {
  var src = ''

  return splicer([
    'transform', [ through(onwrite, onend) ],
    'wrap', []
  ])

  function onwrite (chunk, enc, cb) {
    src += chunk
    cb()
  }
  function onend (cb) {
    var self = this
    babel.transform(src, opts, function (err, result) {
      if (err) return cb(err)

      // Add a closure so that babel helpers are inside it.
      self.push('(function(){' + result.code + '}())')
      cb()
    })
  }
}
