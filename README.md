# Garage v1.1 

Applicazione web per la gestione del garage e il tracciamento degli interventi di manutenzione sui propri veicoli.

## Funzionalità

### Garage
- Aggiunta, modifica e cancellazione di veicoli
- Informazioni per veicolo: marca, modello, anno, targa, note
- Statistiche rapide: numero interventi e ultimi km registrati
- Navigazione diretta agli interventi di un veicolo

### Interventi
- Registrazione di interventi di manutenzione con descrizione, data, km e note
- Associazione di ogni intervento a un veicolo
- Filtro per veicolo, anno (popolato dinamicamente) e ricerca testuale
- Ordinamento per data crescente/decrescente

### Sincronizzazione
- Salvataggio automatico con debounce da 400ms
- Indicatore di stato in tempo reale (Salvataggio / Sincronizzato / Errore rete)
- Auto-refresh ogni 60 secondi

## Tecnologie

- **Frontend:** HTML5, CSS3, JavaScript vanilla (single-page application)
- **Backend:** Node.js + Express.js
- **Storage:** file `data.json` (nessun database esterno richiesto)

## Installazione

```bash
npm install
```

## Avvio

```bash
npm start
```

L'applicazione è disponibile su `http://localhost:3000`.

La porta può essere configurata tramite la variabile d'ambiente `PORT`.

## Struttura dati

I dati sono salvati in `data.json` nella root del progetto:

```json
{
  "cars": [
    {
      "id": "string",
      "brand": "string",
      "model": "string",
      "year": "number | null",
      "plate": "string | null",
      "notes": "string | null"
    }
  ],
  "interventions": [
    {
      "id": "string",
      "carId": "string",
      "description": "string",
      "date": "YYYY-MM-DD",
      "km": "number | null",
      "notes": "string | null"
    }
  ]
}
```

## API

| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| GET | `/api/data` | Recupera tutti i dati |
| PUT | `/api/data` | Salva tutti i dati |

## Changelog

### v1.1
- Filtro anno: reset automatico al cambio veicolo
- Filtro anno: anni popolati dinamicamente in base agli interventi del veicolo selezionato

### v1.0
- Prima versione pubblica
