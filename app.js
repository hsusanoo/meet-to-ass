import chalk from 'chalk'
import fs from 'fs'
import yargs from 'yargs'

/**
 *
 * @param {String} transcriptFileName
 * @param {String} outputFileName
 * @return {boolean}
 */
const generateASS = (transcriptFileName, outputFileName) => {
  const configFileName = 'config.json'

  /**
   * Generate message Toast shape
   * @param {Number} h Height
   * @param {Number} w Width
   * @param {Number} x Position in the X axis
   * @param {Number} y Position in the Y axis
   * @param {String} bc Background Color
   * @return {string}
   */
  const getRectangle = (h, w = 450, x = 1030, y = 700, bc = 'FFFFFF') => {
    const RECTANGLE_SHAPE = 'm -38 -6 l 45 -6 b 45 -6 45 -6 45 -6 b 47 -6 48 -5 48 -3 b 48 2 48 8 48 13 b 48 16 47 17 45 17 b 17 17 -10 17 -38 17 b -40 17 -41 16 -41 13 b -41 8 -41 2 -41 -3 b -41 -5 -40 -6 -38 -6'
    const MIN_h = 380
    const MAX_h = 500

    h = h < MIN_h ? MIN_h : (h > MAX_h ? MAX_h : h)

    return `{\\p1\\c&H${bc}&\\pos(${x}, ${y})\\fscx${w}\\fscy${h}}${RECTANGLE_SHAPE}{\\p0}`
  }

  const splitText = (text) => {
    const splitted = text.split(':')
    return ({ username: splitted[0].trim(), comment: splitted[1].trim() })
  }

  const trimText = (text) => {
    const maxLength = 42 * 3
    return text.length <= maxLength ? text : text.slice(0, maxLength - 3) + '...'
  }

  let numOfLines

  /**
   * Insert line breaks in text
   * @param {String} text
   * @return {string}
   */
  const getFormattedText = (text) => {
    numOfLines = 1
    const maxChar = 42
    // Get only the comment from the text
    let comment = text

    let pos = maxChar
    comment = comment.split('')

    while (pos < comment.length && numOfLines < 3) {

      while (comment[pos] !== ' ') pos--

      // Insert break
      comment.splice(pos, 1, '\\', 'N')

      numOfLines++
      pos += 42 + 3
    }

    return comment.join('')
  }

  const getStyledText = (text) => {
    const { username, comment } = splitText(text)
    return `{\\b1\\c&H606B05&\\fnOpen Sans\\fs24\\pos(890,660)}${username}{\\b0}\\N\\N{\\c&H000000&\\fnRoboto\\fs20}${getFormattedText(
      trimText(
        comment))}`
  }

  const parseTranscript = (trans) => {
    // Get each line
    const data = trans.split(/\n+/)
    const dialogues = []

    for (let i = 0; i < data.length; i++) {
      const [start, finish] = data[i].split((','))
      dialogues.push({
        start,
        finish,
        text: data[++i]
      })
    }

    return dialogues
  }

// Load transcript data form file
  const rawTranscript = fs.readFileSync(transcriptFileName, 'utf8')
  const transcript = parseTranscript(rawTranscript.trim())

// Load subtitles configuration
  const rawConfig = fs.readFileSync(configFileName, 'utf8')
  const assConfig = JSON.parse(rawConfig)

  /**
   *
   * @param {Object} config
   * @param {[Object]} trans
   * @return {string}
   */
  const getASSData = (config, trans) => {
    let data = ''

    let scriptInfo = config['Script Info']
    let styles = config['V4+ Styles']

    data += '[Script Info]\n'
    Object.keys(scriptInfo).forEach(key => {
      data += `${key}: ${scriptInfo[key]}\n`
    })

    data += '\n[V4+ Styles]\n'
    data += `Format: ${Object.keys(styles[0]).join(', ')}\n`

    data += 'Style: '
    styles.forEach(style => {
      data += `${Object.values(style).join(',')}\n`
    })

    data += '\n[Events]\n'
    data += 'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n'

    /**
     * Render 2 digits for milliseconds in the timing
     * @param {String} timestamp
     * @return {String}
     */
    const roundTiming = (timestamp) => {
      const splitTimestamp = timestamp.split('.')
      return splitTimestamp[1].length === 2
        ? timestamp
        : splitTimestamp[1].length < 2
          ? timestamp + '0'
          : splitTimestamp[0] + '.' + splitTimestamp[1].split('').slice(0, 2).join('')
    }

    trans.forEach(dialogue => {
      let { start, finish, text } = dialogue

      start = roundTiming(start)
      finish = roundTiming(finish)

      const base = `Dialogue: 0,${start}, ${finish}, ${styles[0]['Name']},,0,0,0,,`
      const styledText = getStyledText(text)
      const rectangle = getRectangle(320 + 60 * numOfLines)

      data += `${base}${rectangle}\n`
      data += `${base}${styledText}\n`
    })

    fs.writeFileSync(outputFileName, data)

    return data
  }

  return !!getASSData(assConfig, transcript)
}

yargs.command({
  command: 'convert',
  aliases: ['c'],
  describe: 'Convert transcript txt to ass file',
  builder: {
    input: {
      type: 'array',
      demandOption: true,
      alias: 'i',
      describe: 'List of transcript files'
    },
    output: {
      type: 'array',
      alias: 'o',
      describe: 'List of output subtitle files'
    }
  },
  handler: ({ input, output = input.map(f => `${f}.ass`) }) => {
    if (input.length !== output.length) {
      console.error('The number of input files does not match the number of output files.')
      return
    }
    console.log(`Processing ${input.length} file${input.length === 1 ? '' : 's'}...`)
    for (let i = 0; i < input.length; i++) {
      console.log(`File ${i + 1}:`)
      let success = generateASS(input[i], output[i])
      console.log(success ? chalk.green(`✔ Subtitles generated under "${chalk.yellow(output[i])}"!`) : chalk.red('✖ Something went wrong.'))
    }
  }
}).parse()
