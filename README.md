# GENCO Prototype

Prototype man hinh Tao moi quy trinh gop y Du thao.

## File structure

- `index.html`: markup chinh cua man hinh va cac modal.
- `assets/css/styles.css`: toan bo style, design tokens, layout, table, modal, button.
- `assets/js/mock-data.js`: du lieu demo, user Orgchart, file rule va validation message.
- `assets/js/app.js`: xu ly UI, upload file, validate, modal, toast va render bang.

## Run

Mo truc tiep `index.html` bang trinh duyet. Prototype khong can build tool hoac dev server.

## Edit nhanh

- Doi du lieu demo: sua `assets/js/mock-data.js`.
- Doi giao dien: sua `assets/css/styles.css`.
- Doi hanh vi: sua `assets/js/app.js`.

## Material icons

`index.html` da link Material Symbols Outlined. Dung icon bang ten tren Google Fonts:

```html
<span class="material-symbols-outlined">visibility</span>
<span class="material-symbols-outlined">delete</span>
```

Trong JS co helper `materialIcon("visibility")`.
