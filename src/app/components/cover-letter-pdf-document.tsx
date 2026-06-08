import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10.5,
    color: '#000000',
    paddingTop: '14mm',
    paddingBottom: '14mm',
    paddingLeft: '14mm',
    paddingRight: '14mm',
    lineHeight: 1.5,
  },
  h1: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    lineHeight: 1.1,
    marginBottom: 2,
  },
  bold: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10.5,
    marginBottom: 1,
  },
  hr: {
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    marginTop: 8,
    marginBottom: 8,
  },
  para: {
    marginBottom: 6,
  },
})

type Token =
  | { type: 'h1'; text: string }
  | { type: 'bold'; text: string }
  | { type: 'hr' }
  | { type: 'para'; text: string }

function parseMarkdown(md: string): Token[] {
  const tokens: Token[] = []
  const lines = md.split('\n')
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.startsWith('# ')) {
      tokens.push({ type: 'h1', text: line.slice(2) })
      i++
      continue
    }

    if (/^\*\*(.+)\*\*$/.test(line)) {
      tokens.push({ type: 'bold', text: line.replace(/^\*\*|\*\*$/g, '') })
      i++
      continue
    }

    if (line.trim() === '---') {
      tokens.push({ type: 'hr' })
      i++
      continue
    }

    if (line.trim() !== '') {
      // Collect consecutive non-empty lines as one paragraph
      const parts: string[] = []
      while (i < lines.length && lines[i].trim() !== '') {
        parts.push(lines[i])
        i++
      }
      tokens.push({ type: 'para', text: parts.join('\n') })
      continue
    }

    i++
  }

  return tokens
}

export function CoverLetterPDFDocument({
  content,
  filename: _filename,
}: {
  content: string
  filename?: string
}) {
  const tokens = parseMarkdown(content)

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {tokens.map((token, i) => {
          switch (token.type) {
            case 'h1':
              return <Text key={i} style={s.h1}>{token.text}</Text>
            case 'bold':
              return <Text key={i} style={s.bold}>{token.text}</Text>
            case 'hr':
              return <View key={i} style={s.hr} />
            case 'para':
              return <Text key={i} style={s.para}>{token.text}</Text>
          }
        })}
      </Page>
    </Document>
  )
}
