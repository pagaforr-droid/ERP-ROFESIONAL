import codecs
with codecs.open('components/CollectionConsolidation.tsx', 'r', 'utf-8') as f:
    text = f.read()

replacements = {
    'Â¡': '¡', 'Ã³': 'ó', 'Ã­': 'í', 'Ãº': 'ú', 'NÂ°': 'N°', 'Ã“': 'Ó', 'AÃºn': 'Aún',
    'mÃºltiple': 'múltiple', 'EdiciÃ³n': 'Edición', 'AcciÃ³n': 'Acción',
    'recaudaciÃ³n': 'recaudación', 'AnularÃ¡': 'Anulará', 'seleccionarÃ¡': 'seleccionará',
    'RevertirÃ¡': 'Revertirá', 'âœ•': '✕', 'VacÃ­a': 'Vacía', 'CÃ³digo': 'Código',
    'Â¿': '¿'
}

for k, v in replacements.items():
    text = text.replace(k, v)

with codecs.open('components/CollectionConsolidation.tsx', 'w', 'utf-8') as f:
    f.write(text)
