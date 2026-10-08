export function serverInfo() {
  const now = new Date()
  const pad = (num: number) => String(num).padStart(2, '0')
  const time = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  return `Live-System (Version 1.5-74, Serverzeit ${time}, 1 active users)`
}
