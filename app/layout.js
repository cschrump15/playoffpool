export const metadata = {
  title: '2026 Playoff Pool',
  description: 'Chris NHL NBA Playoff Pool',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{margin: 0, padding: 0, background: '#0a0e1a'}}>
        {children}
      </body>
    </html>
  )
}
