// 칸(박스)으로 나뉜 포스터 대응(2026-10-18): 전체 1회 + 겹치는 조각(2열×3행)을 2배 확대해 각각 읽고 글을 합친다.
// 근거: #4828 포스터는 전체를 한 번에 읽으면 왼쪽 급여 칸과 오른쪽 업무 칸이 섞여 '5.500.000'을 놓쳤고,
//       급여 칸만 읽으면 정확히 읽었다. 조각 글은 원본 이미지에서만 나오므로 없는 값을 만들어내지 않는다.
import { execFileSync } from 'node:child_process'

/** 겹치는 조각 좌표 [{x,y,w,h}]. 겹침은 칸 경계에 걸린 글자가 잘리지 않게 하려는 것. */
export function tileBoxes(width, height, cols = 2, rows = 3, overlap = 0.15) {
  const boxes = []
  const tw = Math.ceil(width / cols), th = Math.ceil(height / rows)
  const ox = Math.round(tw * overlap), oy = Math.round(th * overlap)
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = Math.max(0, c * tw - ox), y = Math.max(0, r * th - oy)
    boxes.push({ x, y, w: Math.min(width, (c + 1) * tw + ox) - x, h: Math.min(height, (r + 1) * th + oy) - y })
  }
  return boxes
}

const tesseract = (file) => execFileSync('tesseract', [file, 'stdout', '-l', 'vie', '--psm', '6'], { encoding: 'utf8' })

/** 이미지 1장의 OCR 글: 전체 + 조각. ImageMagick(identify/convert) 필요. */
export function readImage(file) {
  const texts = [tesseract(file)]
  const [w, h] = execFileSync('identify', ['-format', '%w %h', `${file}[0]`], { encoding: 'utf8' }).trim().split(/\s+/).map(Number)
  for (const [i, b] of tileBoxes(w, h).entries()) {
    const tile = `${file}.tile${i}.png`
    execFileSync('convert', [`${file}[0]`, '-crop', `${b.w}x${b.h}+${b.x}+${b.y}`, '+repage', '-resize', '200%', tile])
    texts.push(tesseract(tile))
  }
  return texts.join('\n')
}
