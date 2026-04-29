const fs = require('fs');
let content = fs.readFileSync('components/CollectionConsolidation.tsx', 'utf8');

// Replace encodings
content = content.replace(/Â¡/g, '¡');
content = content.replace(/Ã³/g, 'ó');
content = content.replace(/Ã­/g, 'í');
content = content.replace(/Ãº/g, 'ú');
content = content.replace(/NÂ°/g, 'N°');
content = content.replace(/Ã“/g, 'Ó');
content = content.replace(/AÃºn/g, 'Aún');
content = content.replace(/mÃºltiple/g, 'múltiple');
content = content.replace(/EdiciÃ³n/g, 'Edición');
content = content.replace(/AcciÃ³n/g, 'Acción');
content = content.replace(/recaudaciÃ³n/g, 'recaudación');
content = content.replace(/AnularÃ¡/g, 'Anulará');
content = content.replace(/seleccionarÃ¡/g, 'seleccionará');
content = content.replace(/RevertirÃ¡/g, 'Revertirá');
content = content.replace(/âœ•/g, '✕');
content = content.replace(/VacÃ­a/g, 'Vacía');

fs.writeFileSync('components/CollectionConsolidation.tsx', content, 'utf8');
