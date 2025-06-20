// Configurazione IndexedDB
const DB_NAME = 'RegistroLavoroDB';
const DB_VERSION = 2; // Incrementato per triggerare onupgradeneeded
const STORE_NAME = 'registri';
let db = null;

let recordSelezionato = null;
let modalitaModifica = false;
let ordinamento = { campo: null, direzione: null };
let filtri = {
    azienda: '',
    dataInizio: '',
    dataFine: '',
    motivazioneExtra: ''
};

let showTotalHours = false; // Nuova variabile per controllare la visibilità del totale ore

// Riferimenti agli elementi DOM per il ridimensionamento e i totali
// Vengono recuperati quando il DOM è pronto, in 'DOMContentLoaded'
let mainContent;
let gridSection;
let formSection;
let resizer;
let totalHoursDisplay;
let totalWorkedHoursSpan;
let totalExtraHoursSpan; // Nuovo span per le ore extra
let totalGlobalHoursSpan; // Nuovo span per il totale globale


// Variabili per il ridimensionamento
let isResizing = false;
let lastDownX = 0;
let initialGridWidth = 0;
let initialFormWidth = 0;

// Larghezze minime per le sezioni (in pixel)
const MIN_GRID_WIDTH = 300;
const MIN_FORM_WIDTH = 320;
const GAP_WIDTH = 0; // Il gap non è più gestito da flex-gap ma dalla larghezza del resizer in JS per questo layout

// Funzione per mostrare un messaggio personalizzato invece di alert()
function showMessage(message, type = 'info') {
    const messageBox = document.createElement('div');
    messageBox.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background-color: ${type === 'error' ? '#f44336' : '#4CAF50'};
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        z-index: 1000;
        opacity: 0.9;
        transition: opacity 0.3s ease-in-out;
    `;
    messageBox.textContent = message;
    document.body.appendChild(messageBox);

    setTimeout(() => {
        messageBox.style.opacity = '0';
        messageBox.addEventListener('transitionend', () => messageBox.remove());
    }, 3000);
}

// Inizializzazione IndexedDB
async function initDB() {
    console.log('initDB: Tentativo di apertura/creazione database.');
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = () => {
            console.error('Errore apertura IndexedDB:', request.error);
            showMessage('Errore nell\'apertura del database.', 'error');
            reject(request.error);
        };
        
        request.onsuccess = () => {
            db = request.result;
            console.log('initDB: Database aperto con successo.');
            resolve(db);
        };
        
        request.onupgradeneeded = (event) => {
            db = event.target.result;
            
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                console.log('initDB: Creazione object store:', STORE_NAME);
                const store = db.createObjectStore(STORE_NAME, { 
                    keyPath: 'id', 
                    autoIncrement: true 
                });
                
                store.createIndex('azienda', 'azienda', { unique: false });
                store.createIndex('data', 'data', { unique: false });
                store.createIndex('motivazioneOreExtra', 'motivazioneOreExtra', { unique: false });
                console.log('initDB: Indici creati.');

                store.transaction.oncomplete = () => {
                    console.log('initDB: Transazione di creazione store completata. Aggiunta dati di esempio.');
                    const transaction = db.transaction([STORE_NAME], 'readwrite');
                    const objectStore = transaction.objectStore(STORE_NAME);
                    
                    const datiEsempio = [
                        {
                            azienda: "TechCorp S.r.l.",
                            data: "2024-06-15",
                            oraInizio: "09:00",
                            pausaInizio: "12:30",
                            pausaFine: "13:30",
                            oraFine: "17:30",
                            oreExtra: "02:00",
                            motivazioneOreExtra: "Urgenza cliente",
                            note: "Sviluppo nuova funzionalità del sistema CRM"
                        },
                        {
                            azienda: "Design Studio",
                            data: "2024-06-16",
                            oraInizio: "10:00",
                            pausaInizio: "13:00",
                            pausaFine: "14:00",
                            oraFine: "18:00",
                            oreExtra: "",
                            motivazioneOreExtra: "",
                            note: "Revisione mockup interfaccia utente"
                        }
                    ];
                    
                    datiEsempio.forEach(dato => {
                        objectStore.add(dato).onerror = (e) => console.error("Errore nell'aggiunta del dato di esempio:", e);
                    });
                };
            } else {
                console.log("initDB: Object store 'registri' già esistente, nessuna nuova creazione. Controllo indici.");
            }
        };
    });
}

// Operazioni CRUD (Create, Read, Update, Delete)
async function aggiungiRecord(record) {
    console.log('aggiungiRecord: Tentativo di aggiungere record:', record);
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    return new Promise((resolve, reject) => {
        const request = store.add(record);
        request.onsuccess = () => {
            showMessage('Record aggiunto con successo!');
            console.log('aggiungiRecord: Record aggiunto con ID:', request.result);
            resolve(request.result);
        };
        request.onerror = () => {
            console.error('Errore aggiunta record:', request.error);
            showMessage('Errore nell\'aggiunta del record.', 'error');
            reject(request.error);
        };
    });
}

async function ottieniTuttiRecord() {
    console.log('ottieniTuttiRecord: Tentativo di recuperare tutti i record.');
    return new Promise((resolve, reject) => {
        if (!db) {
            console.error("ottieniTuttiRecord: Database non inizializzato.");
            showMessage('Database non pronto. Riprova.', 'error');
            return reject("Database non inizializzato");
        }
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();
        
        request.onsuccess = () => {
            let records = request.result;
            console.log('ottieniTuttiRecord: Record recuperati (prima del filtro):', records.length);
            records = applicaFiltriRecord(records);
            console.log('ottieniTuttiRecord: Record dopo il filtro:', records.length);
            
            if (ordinamento.campo) {
                records = ordinaRecord(records, ordinamento.campo, ordinamento.direzione);
                console.log('ottieniTuttiRecord: Record ordinati per:', ordinamento.campo, ordinamento.direzione);
            } else {
                records = records.sort((a, b) => new Date(b.data) - new Date(a.data));
                console.log('ottieniTuttiRecord: Record ordinati per data (default).');
            }
            resolve(records);
        };
        request.onerror = () => {
            console.error('Errore ottenimento record:', request.error);
            showMessage('Errore nel caricamento dei dati.', 'error');
            reject(request.error);
        };
    });
}

async function aggiornaRecordDB(record) {
    console.log('aggiornaRecordDB: Tentativo di aggiornare record:', record);
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    return new Promise((resolve, reject) => {
        const request = store.put(record);
        request.onsuccess = () => {
            showMessage('Record aggiornato con successo!');
            console.log('aggiornaRecordDB: Record aggiornato con ID:', record.id);
            resolve(request.result);
        };
        request.onerror = () => {
            console.error('Errore aggiornamento record:', request.error);
            showMessage('Errore nell\'aggiornamento del record.', 'error');
            reject(request.error);
        };
    });
}

async function eliminaRecordDB(id) {
    console.log('eliminaRecordDB: Tentativo di eliminare record con ID:', id);
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    return new Promise((resolve, reject) => {
        const request = store.delete(id);
        request.onsuccess = () => {
            showMessage('Record eliminato con successo!');
            console.log('eliminaRecordDB: Record eliminato con ID:', id);
            resolve();
        };
        request.onerror = () => {
            console.error('Errore eliminazione record:', request.error);
            showMessage('Errore nell\'eliminazione del record.', 'error');
            reject(request.error);
        };
    });
}

// Funzioni di filtro e ordinamento
function applicaFiltriRecord(records) {
    return records.filter(record => {
        let passa = true;
        
        if (filtri.azienda && !record.azienda.toLowerCase().includes(filtri.azienda.toLowerCase())) {
            passa = false;
        }
        
        if (filtri.dataInizio && record.data < filtri.dataInizio) {
            passa = false;
        }
        
        if (filtri.dataFine && record.data > filtri.dataFine) {
            passa = false;
        }
        
        if (filtri.motivazioneExtra && record.motivazioneOreExtra && 
            !record.motivazioneOreExtra.toLowerCase().includes(filtri.motivazioneExtra.toLowerCase())) {
            passa = false;
        }
        
        return passa;
    });
}

function ordinaRecord(records, campo, direzione) {
    return records.sort((a, b) => {
        let valoreA = a[campo] || '';
        let valoreB = b[campo] || '';
        
        if (campo === 'data') {
            valoreA = new Date(valoreA);
            valoreB = new Date(valoreB);
        }
        
        if (direzione === 'asc') {
            return valoreA > valoreB ? 1 : -1;
        } else {
            return valoreA < valoreB ? 1 : -1;
        }
    });
}

function ordinaColonna(campo) {
    console.log('ordinaColonna: Tentativo di ordinare per', campo);
    if (ordinamento.campo === campo) {
        if (ordinamento.direzione === null) {
            ordinamento.direzione = 'asc';
        } else if (ordinamento.direzione === 'asc') {
            ordinamento.direzione = 'desc';
        } else {
            ordinamento.campo = null;
            ordinamento.direzione = null;
        }
    } else {
        ordinamento.campo = campo;
        ordinamento.direzione = 'asc';
    }
    
    aggiornaIconeOrdinamento();
    caricaDati();
}

function aggiornaIconeOrdinamento() {
    document.querySelectorAll('.sort-icon').forEach(icon => {
        icon.textContent = '↕️';
    });
    
    if (ordinamento.campo) {
        const icon = document.getElementById(`sort-${ordinamento.campo}`);
        if (icon) {
            if (ordinamento.direzione === 'asc') {
                icon.textContent = '↑';
            } else if (ordinamento.direzione === 'desc') {
                icon.textContent = '↓';
            }
        }
    }
}

// Funzioni di gestione della UI
function toggleFiltri() {
    console.log('toggleFiltri: Click sul bottone Filtri.');
    const filterSection = document.getElementById('filterSection');
    filterSection.classList.toggle('visible');
    filterSection.classList.toggle('fade-in');
}

function applicaFiltri() {
    console.log('applicaFiltri: Applicazione filtri.');
    filtri.azienda = document.getElementById('filtroAzienda').value;
    filtri.dataInizio = document.getElementById('filtroDataInizio').value;
    filtri.dataFine = document.getElementById('filtroDataFine').value;
    filtri.motivazioneExtra = document.getElementById('filtroMotivazioneExtra').value;
    
    caricaDati(); // Ricarica i dati con i filtri applicati e aggiorna il totale ore
}

function pulisciFiltri() {
    console.log('pulisciFiltri: Pulizia filtri.');
    document.getElementById('filtroAzienda').value = '';
    document.getElementById('filtroDataInizio').value = '';
    document.getElementById('filtroDataFine').value = '';
    document.getElementById('filtroMotivazioneExtra').value = '';
    
    filtri = {
        azienda: '',
        dataInizio: '',
        dataFine: '',
        motivazioneExtra: ''
    };
    
    caricaDati(); // Ricarica i dati senza filtri e aggiorna il totale ore
}

// Funzioni di esportazione
async function esportaCSV() {
    console.log('esportaCSV: Tentativo di esportare CSV.');
    try {
        const registri = await ottieniTuttiRecord();
        
        const headers = ['Azienda', 'Data', 'Ora Inizio', 'Pausa Inizio', 'Pausa Fine', 'Ora Fine', 'Ore Extra', 'Motivazione Ore Extra', 'Note', 'Ore Lavorate Calcolate'];
        const csvContent = [
            headers.join(','),
            ...registri.map(record => {
                const oreLavorate = calcolaOreLavorateSingoloRecord(record);
                return [
                    `"${record.azienda || ''}"`,
                    formatData(record.data), // Usa formatData per l'esportazione DD/MM/YYYY
                    record.oraInizio || '',
                    record.pausaInizio || '',
                    record.pausaFine || '',
                    record.oraFine || '',
                    record.oreExtra || '',
                    `"${record.motivazioneOreExtra || ''}"`,
                    `"${record.note || ''}"`,
                    oreLavorate
                ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(','); // Aggiunto escaping per CSV
            })
        ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `registro_lavoro_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showMessage('Dati esportati in CSV con successo!');
    } catch (error) {
        console.error('Errore esportazione CSV:', error);
        showMessage('Errore nell\'esportazione CSV.', 'error');
    }
}

// Funzione per convertire la data da YYYY-MM-DD (usata internamente) a DD/MM/YYYY (per visualizzazione/esportazione)
function formatData(dataString) {
    if (!dataString) return '';
    try {
        const [year, month, day] = dataString.split('-');
        return `${day}/${month}/${year}`;
    } catch (e) {
        console.warn("Errore di formattazione data:", dataString, e);
        return dataString;
    }
}

// Funzione per convertire la data da DD/MM/YYYY (dal CSV) a YYYY-MM-DD (per il DB)
function convertiDataPerDB(dataString) {
    if (!dataString) return '';
    const parts = dataString.split('/');
    if (parts.length === 3) {
        const [day, month, year] = parts;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    return dataString; // Ritorna la stringa originale se non è nel formato atteso
}


// Funzione per l'importazione CSV
function importaCSV() {
    console.log('importaCSV: Avvio importazione CSV.');
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';

    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) {
            showMessage('Nessun file selezionato.', 'info');
            return;
        }

        const reader = new FileReader();
        reader.onload = async (event) => {
            const csvContent = event.target.result;
            const recordsToImport = parseCSV(csvContent);
            console.log('importaCSV: Record parsificati:', recordsToImport.length);

            let importedCount = 0;
            let errorCount = 0;

            for (const recordData of recordsToImport) {
                try {
                    // Mappa i dati dal CSV ai campi del record
                    const record = {
                        azienda: recordData['Azienda'] || '',
                        data: convertiDataPerDB(recordData['Data']), // Converte la data per il DB
                        oraInizio: recordData['Ora Inizio'] || '',
                        pausaInizio: recordData['Pausa Inizio'] || '',
                        pausaFine: recordData['Pausa Fine'] || '',
                        oraFine: recordData['Ora Fine'] || '',
                        oreExtra: recordData['Ore Extra'] || '',
                        motivazioneOreExtra: recordData['Motivazione Ore Extra'] || '',
                        note: recordData['Note'] || ''
                    };

                    // Validazione minima prima dell'aggiunta
                    if (!record.azienda || !record.data || !record.oraInizio || !record.oraFine) {
                        console.warn('Record ignorato per dati mancanti:', recordData);
                        errorCount++;
                        continue;
                    }

                    await aggiungiRecord(record);
                    importedCount++;
                } catch (err) {
                    console.error('Errore nell\'importazione del record:', recordData, err);
                    errorCount++;
                }
            }

            showMessage(`Importazione completata: ${importedCount} record aggiunti, ${errorCount} errori.`);
            await caricaDati(); // Ricarica la griglia dopo l'importazione
        };
        reader.readAsText(file);
    };

    input.click(); // Apre la finestra di selezione file
}

// Funzione di utility per parsificare il CSV
function parseCSV(csvString) {
    const lines = csvString.split('\n').filter(line => line.trim() !== ''); // Rimuovi righe vuote
    if (lines.length === 0) return [];

    const headers = lines[0].split(',').map(header => header.trim().replace(/^"|"$/g, '').replace(/""/g, '"')); // Rimuovi apici e gestisci doppi apici
    const records = [];

    for (let i = 1; i < lines.length; i++) {
        // Simple regex to split by comma, ignoring commas within double quotes
        // This regex is a basic attempt and might not handle all edge cases of CSV
        // Modifica qui: aggiunta una regex più robusta per la suddivisione e pulizia dei valori
        const values = [];
        let inQuote = false;
        let currentValue = '';
        for (let j = 0; j < lines[i].length; j++) {
            const char = lines[i][j];
            if (char === '"') {
                if (j + 1 < lines[i].length && lines[i][j + 1] === '"') {
                    // Doppio apice escapato (es. "" dentro "testo con ""apice""")
                    currentValue += '"';
                    j++; // Salta il secondo apice
                } else {
                    inQuote = !inQuote;
                }
            } else if (char === ',' && !inQuote) {
                values.push(currentValue);
                currentValue = '';
            } else {
                currentValue += char;
            }
        }
        values.push(currentValue); // Aggiungi l'ultimo valore

        if (values.length !== headers.length) {
            console.warn(`Riga CSV ignorata a causa di formato non corrispondente alle intestazioni: "${lines[i]}"`);
            continue;
        }

        const record = {};
        for (let j = 0; j < headers.length; j++) {
            // Rimuovi spazi e doppi apici extra all'inizio e alla fine del valore
            record[headers[j]] = (values[j] || '').trim().replace(/^"|"$/g, '').replace(/""/g, '"');
        }
        records.push(record);
    }
    return records;
}

async function esportaPDF() {
    console.log('esportaPDF: Tentativo di esportare PDF.');
    try {
        const registri = await ottieniTuttiRecord();
        
        const printContent = `
            <html>
            <head>
                <title>Registro di Lavoro</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    h1 { color: #333; text-align: center; margin-bottom: 30px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
                    th { background-color: #667eea; color: white; }
                    tr:nth-child(even) { background-color: #f2f2f2; }
                </style>
            </head>
            <body>
                <h1>📋 Registro di Lavoro</h1>
                <p>Generato il: ${new Date().toLocaleDateString('it-IT')}</p>
                <table>
                    <thead>
                        <tr>
                            <th>Azienda</th>
                            <th>Data</th>
                            <th>Ora Inizio</th>
                            <th>Pausa Inizio</th>
                            <th>Pausa Fine</th>
                            <th>Ora Fine</th>
                            <th>Ore Extra</th>
                            <th>Motivazione</th>
                            <th>Note</th>
                            <th>Ore Lavorate</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${registri.map(record => `
                            <tr>
                                <td>${record.azienda || ''}</td>
                                <td>${formatData(record.data)}</td>
                                <td>${record.oraInizio || ''}</td>
                                <td>${record.pausaInizio || ''}</td>
                                <td>${record.pausaFine || ''}</td>
                                <td>${record.oraFine || ''}</td>
                                <td>${record.oreExtra || ''}</td>
                                <td>${record.motivazioneOreExtra || ''}</td>
                                <td>${record.note || ''}</td>
                                <td>${calcolaOreLavorateSingoloRecord(record)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </body>
            </html>
        `;
        
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(printContent);
            printWindow.document.close();
            printWindow.print();
            showMessage('Generazione PDF completata!');
        } else {
            showMessage('Impossibile aprire la finestra di stampa. Controlla il blocco popup.', 'error');
        }
    } catch (error) {
        console.error('Errore esportazione PDF:', error);
        showMessage('Errore nell\'esportazione PDF.', 'error');
    }
}


// Funzione per impostare le larghezze iniziali quando il form è visibile
function setInitialPanelWidths() {
    console.log('setInitialPanelWidths: Impostazione larghezze iniziali.');
    if (!mainContent || !gridSection || !formSection || !resizer) {
        console.error('setInitialPanelWidths: Elementi DOM non definiti. Chiamare initDOMElements().');
        return;
    }

    const defaultFormWidth = 400; // Larghezza iniziale desiderata per la form
    const mainContentWidth = mainContent.offsetWidth;
    const resizerWidth = resizer.offsetWidth;
    
    let calculatedGridWidth = mainContentWidth - defaultFormWidth - resizerWidth - GAP_WIDTH;

    if (calculatedGridWidth < MIN_GRID_WIDTH) {
        calculatedGridWidth = MIN_GRID_WIDTH;
        let tempFormWidth = mainContentWidth - MIN_GRID_WIDTH - resizerWidth - GAP_WIDTH;
        formSection.style.flexBasis = `${Math.max(tempFormWidth, MIN_FORM_WIDTH)}px`;
    } else {
        formSection.style.flexBasis = `${defaultFormWidth}px`;
    }
    
    gridSection.style.flexBasis = `${calculatedGridWidth}px`;
    gridSection.style.flexGrow = 1;
    gridSection.style.flexShrink = 1;
    formSection.style.flexGrow = 0;
    formSection.style.flexShrink = 0;

    resizer.classList.add('visible');
    console.log('setInitialPanelWidths: Larghezze impostate. Resizer visibile.');
}

// Handler per l'inizio del trascinamento
function handleResizerMousedown(e) {
    console.log('handleResizerMousedown: Inizio trascinamento.');
    if (window.innerWidth <= 1200) {
        console.log('handleResizerMousedown: Ridimensionamento disabilitato su schermi piccoli.');
        return;
    }

    isResizing = true;
    lastDownX = e.clientX;
    initialGridWidth = gridSection.offsetWidth;
    initialFormWidth = formSection.offsetWidth;

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ew-resize';

    document.addEventListener('mousemove', mouseMoveHandler);
    document.addEventListener('mouseup', mouseUpHandler);
}

// Handler per il movimento del mouse durante il trascinamento
function mouseMoveHandler(e) {
    if (!isResizing) return;

    const deltaX = e.clientX - lastDownX;
    const totalAvailableWidth = mainContent.offsetWidth - resizer.offsetWidth - GAP_WIDTH;

    let newGridWidth = initialGridWidth + deltaX;
    let newFormWidth = initialFormWidth - deltaX;

    newGridWidth = Math.max(MIN_GRID_WIDTH, newGridWidth);
    newFormWidth = Math.max(MIN_FORM_WIDTH, newFormWidth);

    const currentCombinedWidth = newGridWidth + newFormWidth;
    if (currentCombinedWidth > totalAvailableWidth) {
        const diff = currentCombinedWidth - totalAvailableWidth;
        if (newGridWidth - diff >= MIN_GRID_WIDTH) {
            newGridWidth -= diff;
        } else if (newFormWidth - diff >= MIN_FORM_WIDTH) {
            newFormWidth -= diff;
        }
    }

    gridSection.style.flexBasis = `${newGridWidth}px`;
    formSection.style.flexBasis = `${newFormWidth}px`;
}

// Handler per la fine del trascinamento
function mouseUpHandler() {
    console.log('mouseUpHandler: Fine trascinamento.');
    isResizing = false;

    document.body.style.userSelect = '';
    document.body.style.cursor = '';

    document.removeEventListener('mousemove', mouseMoveHandler);
    document.removeEventListener('mouseup', mouseUpHandler);
}

// Funzioni per la gestione dei record (Nuovo, Modifica, Elimina, Salva, Annulla, Seleziona)
function nuovoRecord() {
    console.log('nuovoRecord: Inizio nuova operazione.');
    modalitaModifica = false;
    recordSelezionato = null;
    document.getElementById('recordForm').reset();
    document.getElementById('formTitle').textContent = 'Nuovo Record';
    document.getElementById('btnModifica').disabled = true;
    document.getElementById('btnElimina').disabled = true;
    document.getElementById('data').valueAsDate = new Date();
    
    const formSection = document.querySelector('.form-section');
    formSection.classList.add('visible', 'fade-in');
    setInitialPanelWidths();
}

function modificaRecord() {
    console.log('modificaRecord: Inizio operazione di modifica.');
    if (recordSelezionato) {
        modalitaModifica = true;
        document.getElementById('formTitle').textContent = 'Modifica Record';
        
        document.getElementById('azienda').value = recordSelezionato.azienda || '';
        document.getElementById('data').value = recordSelezionato.data || '';
        document.getElementById('oraInizio').value = recordSelezionato.oraInizio || '';
        document.getElementById('pausaInizio').value = recordSelezionato.pausaInizio || '';
        document.getElementById('pausaFine').value = recordSelezionato.pausaFine || '';
        document.getElementById('oraFine').value = recordSelezionato.oraFine || '';
        document.getElementById('oreExtra').value = recordSelezionato.oreExtra || '';
        document.getElementById('motivazioneOreExtra').value = recordSelezionato.motivazioneOreExtra || '';
        document.getElementById('note').value = recordSelezionato.note || '';

        const formSection = document.querySelector('.form-section');
        formSection.classList.add('visible', 'fade-in');
        setInitialPanelWidths();
    } else {
        showMessage('Seleziona un record da modificare.', 'info');
    }
}

async function eliminaRecord() {
    // Ho mantenuto window.confirm per la compatibilità immediata con la sua richiesta,
    // ma in un'applicazione reale andrebbe sostituito con un modal custom.
    console.log('eliminaRecord: Tentativo di eliminazione.');
    if (recordSelezionato && window.confirm('Sei sicuro di voler eliminare questo record?')) {
        try {
            await eliminaRecordDB(recordSelezionato.id);
            recordSelezionato = null;
            modalitaModifica = false;
            document.getElementById('btnModifica').disabled = true;
            document.getElementById('btnElimina').disabled = true;
            document.getElementById('recordForm').reset();
            
            const formSection = document.querySelector('.form-section');
            formSection.classList.remove('visible', 'fade-in');
            resizer.classList.remove('visible');

            gridSection.style.flexBasis = 'auto'; 
            gridSection.style.flexGrow = 1;
            formSection.style.flexBasis = 'auto';
            formSection.style.flexGrow = 0;
            formSection.style.flexShrink = 0;

            await caricaDati();
        } catch (error) {
            console.error('Errore durante l\'eliminazione:', error);
            showMessage('Errore durante l\'eliminazione del record.', 'error');
        }
    } else if (!recordSelezionato) {
        showMessage('Seleziona un record da eliminare.', 'info');
    }
}

async function salvaRecord() {
    console.log('salvaRecord: Tentativo di salvare record.');
    const record = {
        azienda: document.getElementById('azienda').value,
        data: document.getElementById('data').value,
        oraInizio: document.getElementById('oraInizio').value,
        pausaInizio: document.getElementById('pausaInizio').value,
        pausaFine: document.getElementById('pausaFine').value,
        oraFine: document.getElementById('oraFine').value,
        oreExtra: document.getElementById('oreExtra').value,
        motivazioneOreExtra: document.getElementById('motivazioneOreExtra').value,
        note: document.getElementById('note').value
    };

    if (!record.azienda || !record.data || !record.oraInizio || !record.oraFine) {
        showMessage('Per favor, compila tutti i campi obbligatori (*).', 'error');
        return;
    }

    try {
        if (modalitaModifica && recordSelezionato) {
            record.id = recordSelezionato.id;
            await aggiornaRecordDB(record);
        } else {
            await aggiungiRecord(record);
        }
        
        document.getElementById('recordForm').reset();
        recordSelezionato = null;
        modalitaModifica = false;
        document.getElementById('btnModifica').disabled = true;
        document.getElementById('btnElimina').disabled = true;
        
        const formSection = document.querySelector('.form-section');
        formSection.classList.remove('visible', 'fade-in');
        resizer.classList.remove('visible');
        
        gridSection.style.flexBasis = 'auto';
        gridSection.style.flexGrow = 1;
        formSection.style.flexBasis = 'auto';
        formSection.style.flexGrow = 0;
        formSection.style.flexShrink = 0;

        await caricaDati();
    } catch (error) {
        console.error('Errore durante il salvataggio:', error);
        showMessage('Errore durante il salvataggio del record.', 'error');
    }
}

function annullaOperazione() {
    console.log('annullaOperazione: Annullamento operazione.');
    document.getElementById('recordForm').reset();
    recordSelezionato = null;
    modalitaModifica = false;
    document.getElementById('btnModifica').disabled = true;
    document.getElementById('btnElimina').disabled = true;
    
    const formSection = document.querySelector('.form-section');
    formSection.classList.remove('visible', 'fade-in');
    resizer.classList.remove('visible');

    gridSection.style.flexBasis = 'auto';
    gridSection.style.flexGrow = 1;
    formSection.style.flexBasis = 'auto';
    formSection.style.flexGrow = 0;
    formSection.style.flexShrink = 0;

    const righeSelezionate = document.querySelectorAll('.grid tr.selected');
    righeSelezionate.forEach(row => row.classList.remove('selected'));
}

let rigaCorrenteSelezionata = null; // Variabile per tenere traccia della riga selezionata

function selezionaRecord(record, rowElement) {
    console.log('selezionaRecord: Record selezionato:', record.id);
    if (rigaCorrenteSelezionata) {
        rigaCorrenteSelezionata.classList.remove('selected');
    }

    rowElement.classList.add('selected');
    rigaCorrenteSelezionata = rowElement;

    recordSelezionato = record;
    document.getElementById('btnModifica').disabled = false;
    document.getElementById('btnElimina').disabled = false;
    
    if (!modalitaModifica) {
        document.querySelector('.form-section').classList.remove('visible', 'fade-in');
        resizer.classList.remove('visible');
    }
}

// Funzioni per il calcolo delle ore lavorate e extra
function parseTimeToMinutes(timeString) {
    if (!timeString) return 0;
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
}

// Nuova funzione: converte una durata HH:MM in minuti
function parseDurationToMinutes(durationString) {
    if (!durationString) return 0;
    // La stringa può essere "HH:MM" o "H:MM" o "MM" se c'è solo un segmento
    const parts = durationString.split(':');
    let totalMinutes = 0;
    if (parts.length === 2) {
        totalMinutes = parseInt(parts[0] || '0') * 60 + parseInt(parts[1] || '0');
    } else if (parts.length === 1) {
        // Se c'è solo un numero, assumiamo siano minuti o ore intere (preferiamo minuti per "extra")
        totalMinutes = parseInt(parts[0] || '0'); 
    }
    return totalMinutes;
}


function formatMinutesToHHMM(totalMinutes) {
    if (totalMinutes < 0) totalMinutes = 0; // Evita ore negative
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function calcolaOreLavorateSingoloRecord(record) {
    try {
        const inizioLavoroMin = parseTimeToMinutes(record.oraInizio);
        const fineLavoroMin = parseTimeToMinutes(record.oraFine);
        const inizioPausaMin = parseTimeToMinutes(record.pausaInizio);
        const finePausaMin = parseTimeToMinutes(record.pausaFine);

        let oreLavorateMin = 0;
        if (fineLavoroMin > inizioLavoroMin) {
            oreLavorateMin = fineLavoroMin - inizioLavoroMin;
        } else if (fineLavoroMin < inizioLavoroMin) {
            oreLavorateMin = (24 * 60 - inizioLavoroMin) + fineLavoroMin;
        }

        let durataPausaMin = 0;
        if (record.pausaInizio && record.pausaFine && finePausaMin > inizioPausaMin) {
            durataPausaMin = finePausaMin - inizioPausaMin;
        }

        const totalMinutesWorked = oreLavorateMin - durataPausaMin;
        return formatMinutesToHHMM(totalMinutesWorked);
    } catch (error) {
        console.error('Errore in calcolaOreLavorateSingoloRecord per record:', record, error);
        return "N/D"; // Not Available
    }
}

async function updateAllTotalsDisplay() {
    console.log('updateAllTotalsDisplay: Inizio calcolo di tutti i totali.');
    try {
        const registriLavoroFiltrati = await ottieniTuttiRecord(); // Ottiene già i record filtrati
        let totalWorkedMinutes = 0;
        let totalExtraMinutes = 0;

        registriLavoroFiltrati.forEach(record => {
            const oreLavorateMin = parseTimeToMinutes(calcolaOreLavorateSingoloRecord(record));
            totalWorkedMinutes += oreLavorateMin;
            
            const oreExtraMin = parseDurationToMinutes(record.oreExtra);
            totalExtraMinutes += oreExtraMin;
        });

        const totalGlobalMinutes = totalWorkedMinutes + totalExtraMinutes;

        if (totalWorkedHoursSpan) totalWorkedHoursSpan.textContent = formatMinutesToHHMM(totalWorkedMinutes);
        if (totalExtraHoursSpan) totalExtraHoursSpan.textContent = formatMinutesToHHMM(totalExtraMinutes);
        if (totalGlobalHoursSpan) totalGlobalHoursSpan.textContent = formatMinutesToHHMM(totalGlobalMinutes);
        
        console.log('updateAllTotalsDisplay: Totali aggiornati.');
    } catch (error) {
        console.error('Errore in updateAllTotalsDisplay:', error);
        if (totalWorkedHoursSpan) totalWorkedHoursSpan.textContent = "Errore";
        if (totalExtraHoursSpan) totalExtraHoursSpan.textContent = "Errore";
        if (totalGlobalHoursSpan) totalGlobalHoursSpan.textContent = "Errore";
        showMessage('Errore nel calcolo dei totali ore.', 'error');
    }
}

function toggleCalcoloOreLavoro() {
    console.log('toggleCalcoloOreLavoro: Click sul bottone.');
    try {
        showTotalHours = !showTotalHours;
        if (totalHoursDisplay) {
            if (showTotalHours) {
                totalHoursDisplay.classList.add('visible');
                totalHoursDisplay.classList.add('fade-in');
                updateAllTotalsDisplay(); // Chiama la nuova funzione per aggiornare tutti i totali
            } else {
                totalHoursDisplay.classList.remove('visible');
                totalHoursDisplay.classList.remove('fade-in');
            }
        } else {
            console.error('Elemento totalHoursDisplay non trovato!');
            showMessage('Errore: Impossibile visualizzare il totale ore.', 'error');
        }
    } catch (error) {
        console.error('Errore in toggleCalcoloOreLavoro:', error);
        showMessage('Si è verificato un errore inaspettato.', 'error');
    }
}


// Funzione per caricare i dati e popolare la griglia
async function caricaDati() {
    console.log('caricaDati: Inizio caricamento dati per la griglia.');
    try {
        const registriLavoro = await ottieniTuttiRecord(); // Già filtrati e ordinati
        const gridBody = document.getElementById('gridBody');
        const emptyState = document.getElementById('emptyState');
        const dataGrid = document.getElementById('dataGrid');

        // Controllo esistenza elementi DOM cruciali
        if (!gridBody || !emptyState || !dataGrid) {
            console.error('caricaDati: Elementi DOM (gridBody, emptyState, dataGrid) non trovati.');
            showMessage('Errore critico: elementi della tabella non trovati.', 'error');
            return;
        }

        gridBody.innerHTML = '';

        if (registriLavoro.length === 0) {
            emptyState.style.display = 'block';
            dataGrid.style.display = 'none';
            console.log('caricaDati: Nessun record trovato, mostro empty state.');
        } else {
            emptyState.style.display = 'none';
            dataGrid.style.display = 'table';
            console.log('caricaDati: Record trovati, popolamento griglia.');
            
            registriLavoro.forEach(record => {
                const row = document.createElement('tr');
                row.onclick = () => selezionaRecord(record, row);
                row.innerHTML = `
                    <td>${record.azienda || ''}</td>
                    <td>${formatData(record.data)}</td>
                    <td>${record.oraInizio || ''}</td>
                    <td>${record.pausaInizio || ''}</td>
                    <td>${record.pausaFine || ''}</td>
                    <td>${record.oraFine || ''}</td>
                    <td>${record.oreExtra || ''}</td>
                    <td>${record.motivazioneOreExtra || ''}</td>
                    <td>${record.note || ''}</td>
                `;
                gridBody.appendChild(row);
            });
        }

        if (showTotalHours) {
            updateAllTotalsDisplay(); // Aggiorna tutti i totali se la visualizzazione è attiva
        }

    } catch (error) {
        console.error('Errore nel caricamento dei dati per la griglia:', error);
        showMessage('Impossibile caricare i dati del registro.', 'error');
    }
}


// Inizializzazione applicazione quando il DOM è completamente caricato
document.addEventListener('DOMContentLoaded', async function() {
    console.log("DOM fully loaded and parsed. App.js started.");

    // Inizializza i riferimenti agli elementi DOM qui, quando sono sicuramente disponibili
    mainContent = document.querySelector('.main-content');
    gridSection = document.querySelector('.grid-section');
    formSection = document.querySelector('.form-section');
    resizer = document.getElementById('resizer');
    totalHoursDisplay = document.getElementById('totalHoursDisplay');
    totalWorkedHoursSpan = document.getElementById('totalWorkedHours');
    totalExtraHoursSpan = document.getElementById('totalExtraHours'); // Inizializza il nuovo span
    totalGlobalHoursSpan = document.getElementById('totalGlobalHours'); // Inizializza il nuovo span


    // Associa il listener del resizer qui, dopo che 'resizer' è stato definito
    if (resizer) {
        resizer.addEventListener('mousedown', handleResizerMousedown);
        console.log("Resizer event listener attached.");
    } else {
        console.error("Errore: Elemento resizer non trovato all'avvio.");
    }

    // Associa il listener per il submit del form qui
    document.getElementById('recordForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        await salvaRecord();
    });
    console.log("Record form event listener attached.");


    // Inizializzazione database e caricamento dati
    try {
        await initDB();
        console.log("Database initialized successfully.");
        await caricaDati();
        console.log("Data loaded into grid successfully.");
        
        // Imposta la data di oggi nel campo data del form
        const dataInput = document.getElementById('data');
        if (dataInput) {
            dataInput.valueAsDate = new Date();
            console.log("Date input set to today.");
        } else {
            console.warn("Elemento 'data' non trovato.");
        }

    } catch (error) {
        console.error('Errore inizializzazione applicazione:', error);
        showMessage('Errore critico all\'avvio dell\'applicazione. Ricarica la pagina.', 'error');
    }
});
