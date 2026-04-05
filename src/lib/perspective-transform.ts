/*
 *  Optimized version of PerspectiveTransform.js
 *  by Edan Kwan — http://www.edankwan.com/
 *
 *  Original by Israel Pastrana
 *  Matrix Libraries from a Java port of JAMA
 */

export interface Point {
  x: number;
  y: number;
}

let _transformStyleName = "transform";
let _transformOriginStyleName = "transformOrigin";
let _transformOriginDomStyleName = "-webkit-transform-origin";

(function setTransformStyleName() {
  if (typeof document === "undefined") return;
  const testStyle = document.createElement("div").style;
  const prefix =
    "webkitTransform" in testStyle
      ? "webkit"
      : "MozTransform" in testStyle
        ? "Moz"
        : "msTransform" in testStyle
          ? "ms"
          : "";
  _transformStyleName =
    prefix + (prefix.length > 0 ? "Transform" : "transform");
  _transformOriginStyleName =
    prefix + (prefix.length > 0 ? "TransformOrigin" : "transformOrigin");
  _transformOriginDomStyleName =
    "-" + prefix.toLowerCase() + "-transform-origin";
})();

export { _transformStyleName as transformStyleName };
export { _transformOriginStyleName as transformOriginStyleName };

export class PerspectiveTransform {
  element: HTMLElement;
  style: CSSStyleDeclaration;
  computedStyle: CSSStyleDeclaration;
  width: number;
  height: number;
  useBackFacing: boolean;
  topLeft: Point;
  topRight: Point;
  bottomLeft: Point;
  bottomRight: Point;
  calcStyle: string;
  hasError: number;

  static transformStyleName = _transformStyleName;
  static transformOriginStyleName = _transformOriginStyleName;

  constructor(
    element: HTMLElement,
    width: number,
    height: number,
    useBackFacing = false
  ) {
    this.element = element;
    this.style = element.style;
    this.computedStyle = window.getComputedStyle(element);
    this.width = width;
    this.height = height;
    this.useBackFacing = useBackFacing;
    this.topLeft = { x: 0, y: 0 };
    this.topRight = { x: width, y: 0 };
    this.bottomLeft = { x: 0, y: height };
    this.bottomRight = { x: width, y: height };
    this.calcStyle = "";
    this.hasError = 0;
  }

  checkError(): number {
    // Distance check
    const pairs: [Point, Point][] = [
      [this.topLeft, this.topRight],
      [this.bottomLeft, this.bottomRight],
      [this.topLeft, this.bottomLeft],
      [this.topRight, this.bottomRight],
      [this.topLeft, this.bottomRight],
      [this.topRight, this.bottomLeft],
    ];
    for (const [a, b] of pairs) {
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      if (Math.sqrt(dx * dx + dy * dy) <= 1) return 1;
    }

    // Polygon check
    const det = (p0: Point, p1: Point, p2: Point) =>
      p0.x * p1.y + p1.x * p2.y + p2.x * p0.y -
      p0.y * p1.x - p1.y * p2.x - p2.y * p0.x;

    const d1a = det(this.topLeft, this.topRight, this.bottomRight);
    const d2a = det(this.bottomRight, this.bottomLeft, this.topLeft);
    if (this.useBackFacing) {
      if (d1a * d2a <= 0) return 2;
    } else {
      if (d1a <= 0 || d2a <= 0) return 2;
    }
    const d1b = det(this.topRight, this.bottomRight, this.bottomLeft);
    const d2b = det(this.bottomLeft, this.topLeft, this.topRight);
    if (this.useBackFacing) {
      if (d1b * d2b <= 0) return 2;
    } else {
      if (d1b <= 0 || d2b <= 0) return 2;
    }
    return 0;
  }

  calc(): string {
    const { width, height } = this;
    let offsetX = 0;
    let offsetY = 0;
    const offset = this.computedStyle.getPropertyValue(
      _transformOriginDomStyleName
    );
    if (offset.indexOf("px") > -1) {
      const parts = offset.split("px");
      offsetX = -parseFloat(parts[0]);
      offsetY = -parseFloat(parts[1]);
    } else if (offset.indexOf("%") > -1) {
      const parts = offset.split("%");
      offsetX = (-parseFloat(parts[0]) * width) / 100;
      offsetY = (-parseFloat(parts[1]) * height) / 100;
    }

    const dst = [this.topLeft, this.topRight, this.bottomLeft, this.bottomRight];
    const aM = Array.from({ length: 8 }, () => new Array(8).fill(0));
    const bM = new Array(8).fill(0);
    const arr = [0, 1, 2, 3, 4, 5, 6, 7];

    for (let i = 0; i < 4; i++) {
      aM[i][0] = aM[i + 4][3] = i & 1 ? width + offsetX : offsetX;
      aM[i][1] = aM[i + 4][4] = i > 1 ? height + offsetY : offsetY;
      aM[i][6] = (i & 1 ? -offsetX - width : -offsetX) * (dst[i].x + offsetX);
      aM[i][7] =
        (i > 1 ? -offsetY - height : -offsetY) * (dst[i].x + offsetX);
      aM[i + 4][6] =
        (i & 1 ? -offsetX - width : -offsetX) * (dst[i].y + offsetY);
      aM[i + 4][7] =
        (i > 1 ? -offsetY - height : -offsetY) * (dst[i].y + offsetY);
      bM[i] = dst[i].x + offsetX;
      bM[i + 4] = dst[i].y + offsetY;
      aM[i][2] = aM[i + 4][5] = 1;
      aM[i][3] = aM[i][4] = aM[i][5] = 0;
      aM[i + 4][0] = aM[i + 4][1] = aM[i + 4][2] = 0;
    }

    const col: number[] = [];
    for (let j = 0; j < 8; j++) {
      for (let i = 0; i < 8; i++) col[i] = aM[i][j];
      for (let i = 0; i < 8; i++) {
        const row = aM[i];
        const kmax = i < j ? i : j;
        let sum = 0.0;
        for (let k = 0; k < kmax; k++) sum += row[k] * col[k];
        row[j] = col[i] -= sum;
      }
      let p = j;
      for (let i = j + 1; i < 8; i++) {
        if (Math.abs(col[i]) > Math.abs(col[p])) p = i;
      }
      if (p !== j) {
        for (let k = 0; k < 8; k++) {
          const tmp = aM[p][k];
          aM[p][k] = aM[j][k];
          aM[j][k] = tmp;
        }
        const tmp = arr[p];
        arr[p] = arr[j];
        arr[j] = tmp;
      }
      if (aM[j][j] !== 0.0) {
        for (let i = j + 1; i < 8; i++) aM[i][j] /= aM[j][j];
      }
    }

    for (let i = 0; i < 8; i++) arr[i] = bM[arr[i]];
    for (let k = 0; k < 8; k++) {
      for (let i = k + 1; i < 8; i++) arr[i] -= arr[k] * aM[i][k];
    }
    for (let k = 7; k > -1; k--) {
      arr[k] /= aM[k][k];
      for (let i = 0; i < k; i++) arr[i] -= arr[k] * aM[i][k];
    }

    return (this.calcStyle =
      "matrix3d(" +
      arr[0].toFixed(9) + "," + arr[3].toFixed(9) + ", 0," + arr[6].toFixed(9) + "," +
      arr[1].toFixed(9) + "," + arr[4].toFixed(9) + ", 0," + arr[7].toFixed(9) +
      ",0, 0, 1, 0," +
      arr[2].toFixed(9) + "," + arr[5].toFixed(9) + ", 0, 1)");
  }

  update(style?: string): string {
    style = style || this.calcStyle;
    return ((this.style as unknown as Record<string, unknown>)[_transformStyleName] =
      style) as string;
  }
}
