# Ejecución CPU reproducible de Kronos-mini

El código del modelo se conserva bajo `vendor/kronos` con licencia MIT y revisión registrada en `run_kronos.py`. Los pesos se descargan de los repositorios oficiales de NeoQuasar, con revisiones fijadas; no se guardan en Git ni en el Worker.

Desde la raíz del proyecto (en GitHub: `web/`):

```bash
python3 -m venv .local/kronos-env
.local/kronos-env/bin/pip install --extra-index-url https://download.pytorch.org/whl/cpu -r inference/requirements.txt
node scripts/capture-kronos-input.mjs .local/kronos-input.json
.local/kronos-env/bin/python inference/run_kronos.py --input .local/kronos-input.json --output .local/kronos-output.json
```

La captura incluye las 54 monedas y elige PERP si está disponible, SPOT de forma explícita en caso contrario. La inferencia rechaza huecos/velas abiertas/valores no finitos. El monto negociado que requiere el modelo se estima con media OHLC × volumen base, como hace su predictor oficial cuando falta esa columna; no es una medición de volumen nocional nativo.

Se ejecutan tres trayectorias independientes por activo, con semilla fija; el mínimo y máximo son dispersión de esas muestras, sin calibración probabilística. La simulación y las reglas de trading no usan la proyección como confirmación de entrada.

`publish-kronos.mjs` publica únicamente resultados del mercado público en `market-data/kronos.json`. Requiere `GITHUB_REPOSITORY` y el token efímero del workflow, nunca claves de exchange. El workflow se activa en la rama principal tras fusionar su PR; el archivo preparado por sí solo no demuestra una programación en funcionamiento.
