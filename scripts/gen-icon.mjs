import sharp from "sharp";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <!-- 背景: 角丸正方形 -->
  <rect width="512" height="512" rx="110" ry="110" fill="#1e40af"/>

  <!-- カプセル本体（45度回転） -->
  <g transform="translate(256,256) rotate(-45)">
    <!-- 左半分（白） -->
    <path d="M-130,0 A65,65 0 0,0 0,0 L0,-65 A65,65 0 0,0 -130,0 Z
             M-130,0 A65,65 0 0,1 0,0 L0,65 A65,65 0 0,1 -130,0 Z"
          d="M0,-65 A65,65 0 0,0 -130,0 A65,65 0 0,0 0,65 L0,-65Z"
          fill="white"/>
    <!-- 右半分（赤） -->
    <path d="M0,-65 A65,65 0 0,1 130,0 A65,65 0 0,1 0,65 L0,-65Z"
          fill="#ef4444"/>
    <!-- 分割線 -->
    <line x1="0" y1="-68" x2="0" y2="68" stroke="#d1d5db" stroke-width="4"/>
  </g>
</svg>`;

const svgClean = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="110" ry="110" fill="#1e40af"/>
  <!-- カプセル: 中心(256,256)、幅320 高さ120、45度傾け -->
  <g transform="translate(256,256) rotate(-45)">
    <!-- カプセル全体の白ベース -->
    <rect x="-160" y="-60" width="320" height="120" rx="60" ry="60" fill="white"/>
    <!-- 右半分を赤でマスク -->
    <clipPath id="rightHalf">
      <rect x="0" y="-65" width="165" height="130"/>
    </clipPath>
    <rect x="-160" y="-60" width="320" height="120" rx="60" ry="60" fill="#ef4444" clip-path="url(#rightHalf)"/>
    <!-- 中央の分割線 -->
    <rect x="-3" y="-64" width="6" height="128" fill="rgba(200,210,220,0.8)" rx="3"/>
    <!-- ハイライト -->
    <ellipse cx="-60" cy="-28" rx="55" ry="18" fill="white" opacity="0.25"/>
  </g>
</svg>`;

await sharp(Buffer.from(svgClean))
  .resize(512, 512)
  .png()
  .toFile("app/icon.png");

console.log("✅ app/icon.png generated");
