// =============================================
// JUEGO MULTIJUGADOR CON FIREBASE - VERSIÓN CORREGIDA
// =============================================

// ========== CONFIGURACIÓN DE FIREBASE ==========
// PEGA AQUÍ TU firebaseConfig (el que copiaste de Firebase)
const firebaseConfig = {
  apiKey: "AIzaSyCNsxy3s_yHdttY7vkODtK7_PS0x2iSqck",
  authDomain: "memory-multijugador.firebaseapp.com",
  databaseURL: "https://memory-multijugador-default-rtdb.firebaseio.com",
  projectId: "memory-multijugador",
  storageBucket: "memory-multijugador.firebasestorage.app",
  messagingSenderId: "1076658857205",
  appId: "1:1076658857205:web:962fcd437beea36b7fd1bc"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// ========== VARIABLES GLOBALES ==========
let jugadorActual = {
    id: null,
    nombre: '',
    esAnfitrion: false,
    completado: false
};

let juegoActivo = false;      // ← Cambiado de juegoIniciado
let juegoTerminado = false;   // ← Nueva variable
let tiempoRestante = 90;
let intervaloReloj = null;

// Datos del juego
const paresEducativos = [
    { id: 1, concepto: "🐍 Python", definicion: "🐍 Python" },
    { id: 2, concepto: "☕ Java", definicion: "☕ Java" },
    { id: 3, concepto: "C#", definicion: "C#" },
    { id: 4, concepto: "📄 Word", definicion: "📄 Word" },
    { id: 5, concepto: "📊 Excel", definicion: "📊 Excel" },
    { id: 6, concepto: "📽️ PowerPoint", definicion: "📽️ PowerPoint" }
];

// Variables del juego
let tarjetas = [];
let tarjetaSeleccionada = null;
let tarjetaSeleccionadaIndex = null;
let bloqueoTablero = false;
let movimientos = 0;
let paresEncontrados = 0;
const totalPares = paresEducativos.length;

// Elementos DOM
const pantallaLogin = document.getElementById('pantallaLogin');
const pantallaEspera = document.getElementById('pantallaEspera');
const juegoPrincipal = document.getElementById('juegoPrincipal');
const inputNombre = document.getElementById('inputNombre');
const btnIngresar = document.getElementById('btnIngresar');
const listaJugadores = document.getElementById('listaJugadores');
const panelAnfitrion = document.getElementById('panelAnfitrion');
const btnIniciarJuego = document.getElementById('btnIniciarJuego');
const mensajeEspera = document.getElementById('mensajeEspera');
const tablero = document.getElementById('tableroJuego');
const contadorMovimientos = document.querySelector('.contador-movimientos');
const paresEncontradosSpan = document.querySelector('.pares-encontrados');
const totalParesSpan = document.querySelector('.total-pares');
const temporizadorSpan = document.getElementById('temporizador');
const mensajeVictoria = document.getElementById('mensajeVictoria');
const btnSalir = document.getElementById('btnSalir');
const listaRanking = document.getElementById('listaRanking');

totalParesSpan.textContent = totalPares;

// ========== FUNCIONES DE FIREBASE ==========

function ingresarAlJuego() {
    const nombre = inputNombre.value.trim();
    if (!nombre) {
        alert('Ingresa tu nombre');
        return;
    }

    const jugadoresRef = database.ref('jugadores');
    const nuevoJugadorRef = jugadoresRef.push();
    
    jugadorActual.id = nuevoJugadorRef.key;
    jugadorActual.nombre = nombre;
    
    jugadoresRef.once('value', (snapshot) => {
        jugadorActual.esAnfitrion = !snapshot.exists();
        
        nuevoJugadorRef.set({
            nombre: nombre,
            esAnfitrion: jugadorActual.esAnfitrion,
            completado: false,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        
        nuevoJugadorRef.onDisconnect().remove();
        
        pantallaLogin.style.display = 'none';
        pantallaEspera.style.display = 'flex';
        
        if (jugadorActual.esAnfitrion) {
            panelAnfitrion.style.display = 'block';
            mensajeEspera.style.display = 'none';
        }
        
        // Verificar si el juego ya está activo (para reconexiones)
        database.ref('estado/juegoActivo').once('value', (snap) => {
            if (snap.val() === true) {
                alert('El juego ya está en curso. Espera a que termine.');
                reiniciarTodo();
            }
        });
    });
}

function escucharJugadores() {
    const jugadoresRef = database.ref('jugadores');
    
    jugadoresRef.on('value', (snapshot) => {
        const jugadores = snapshot.val();
        listaJugadores.innerHTML = '';
        
        if (jugadores) {
            Object.values(jugadores).forEach(jugador => {
                const div = document.createElement('div');
                div.className = 'jugador-item';
                div.innerHTML = `
                    <span>${jugador.nombre} ${jugador.esAnfitrion ? '👑' : ''}</span>
                    <span>${jugador.completado ? '✅' : '⏳'}</span>
                `;
                listaJugadores.appendChild(div);
            });
        }
    });
}

function escucharInicioJuego() {
    const estadoRef = database.ref('estado/juegoActivo');
    
    estadoRef.on('value', (snapshot) => {
        const activo = snapshot.val();
        
        if (activo === true && !juegoActivo && !juegoTerminado) {
            iniciarJuegoParaTodos();
        }
    });
}

function iniciarJuegoAnfitrion() {
    if (!jugadorActual.esAnfitrion) {
        alert('Solo el anfitrión puede iniciar el juego');
        return;
    }
    
    // Verificar que haya al menos un jugador más
    database.ref('jugadores').once('value', (snapshot) => {
        const jugadores = snapshot.val();
        const cantidad = jugadores ? Object.keys(jugadores).length : 0;
        
        if (cantidad < 1) {
            alert('Espera al menos un jugador más');
            return;
        }
        
        // Limpiar ranking anterior
        database.ref('ranking').remove();
        
        // Activar juego
        database.ref('estado').set({
            juegoActivo: true,
            tiempoInicio: firebase.database.ServerValue.TIMESTAMP
        });
    });
}

function iniciarJuegoParaTodos() {
    juegoActivo = true;
    juegoTerminado = false;
    
    pantallaEspera.style.display = 'none';
    juegoPrincipal.style.display = 'block';
    
    // Inicializar juego
    tarjetas = crearBaraja();
    tarjetaSeleccionada = null;
    tarjetaSeleccionadaIndex = null;
    bloqueoTablero = false;
    movimientos = 0;
    paresEncontrados = 0;
    renderizarTablero();
    escucharRanking();
    
    // Iniciar temporizador
    iniciarTemporizador();
}

// ========== TEMPORIZADOR ==========
function iniciarTemporizador() {
    if (intervaloReloj) {
        clearInterval(intervaloReloj);
    }
    
    tiempoRestante = 90;
    actualizarDisplayTemporizador();
    
    database.ref('estado/tiempoInicio').once('value', (snapshot) => {
        const tiempoInicio = snapshot.val();
        
        intervaloReloj = setInterval(() => {
            const ahora = Date.now();
            const transcurrido = Math.floor((ahora - tiempoInicio) / 1000);
            tiempoRestante = Math.max(90 - transcurrido, 0);
            
            actualizarDisplayTemporizador();
            
            if (tiempoRestante <= 0 && !juegoTerminado) {
                finalizarJuegoPorTiempo();
            }
        }, 100);
    });
}

function actualizarDisplayTemporizador() {
    const minutos = Math.floor(tiempoRestante / 60);
    const segundos = tiempoRestante % 60;
    temporizadorSpan.textContent = `⏱️ ${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`;
}

function finalizarJuegoPorTiempo() {
    if (juegoTerminado) return;
    
    juegoTerminado = true;
    juegoActivo = false;
    bloqueoTablero = true;
    
    clearInterval(intervaloReloj);
    intervaloReloj = null;
    
    alert('⏰ ¡Se acabó el tiempo!');
    
    // Desactivar juego en Firebase
    database.ref('estado/juegoActivo').set(false);
}

// ========== LÓGICA DEL JUEGO ==========
function crearBaraja() {
    let baraja = [];
    paresEducativos.forEach((par) => {
        baraja.push({ id: `c-${par.id}`, parId: par.id, tipo: 'concepto', contenido: par.concepto, acertada: false, volteada: false });
        baraja.push({ id: `d-${par.id}`, parId: par.id, tipo: 'definicion', contenido: par.definicion, acertada: false, volteada: false });
    });
    return baraja.sort(() => Math.random() - 0.5);
}

function renderizarTablero() {
    tablero.innerHTML = '';
    tarjetas.forEach((tarjeta, index) => {
        const tarjetaDiv = document.createElement('div');
        tarjetaDiv.className = 'tarjeta';
        if (tarjeta.acertada) tarjetaDiv.classList.add('acertada');
        if (tarjeta.volteada) tarjetaDiv.classList.add('volteada');
        
        tarjetaDiv.dataset.index = index;
        tarjetaDiv.dataset.parId = tarjeta.parId;
        
        const contenidoDiv = document.createElement('div');
        contenidoDiv.className = 'contenido-tarjeta';
        
        if (tarjeta.acertada || tarjeta.volteada) {
            contenidoDiv.innerHTML = tarjeta.contenido;
            contenidoDiv.classList.add('logo-lenguaje');
        } else {
            contenidoDiv.innerHTML = '❓';
        }
        
        tarjetaDiv.appendChild(contenidoDiv);
        tarjetaDiv.addEventListener('click', () => manejarClickTarjeta(index));
        tablero.appendChild(tarjetaDiv);
    });
    actualizarUI();
}

function manejarClickTarjeta(index) {
    if (!juegoActivo || juegoTerminado) return;
    if (bloqueoTablero || tiempoRestante <= 0) return;
    
    const tarjeta = tarjetas[index];
    if (tarjeta.acertada) return;
    if (tarjetaSeleccionadaIndex === index) return;
    
    const tarjetaActual = tarjetas[index];
    
    if (tarjetaSeleccionada === null) {
        tarjeta.volteada = true;
        tarjetaSeleccionada = tarjetaActual;
        tarjetaSeleccionadaIndex = index;
        renderizarTablero();
        return;
    }
    
    tarjeta.volteada = true;
    movimientos++;
    actualizarUI();
    
    const esPar = tarjetaSeleccionada.parId === tarjetaActual.parId;
    const sonDiferenteTipo = tarjetaSeleccionada.tipo !== tarjetaActual.tipo;
    
    if (esPar && sonDiferenteTipo) {
        tarjetaSeleccionada.acertada = true;
        tarjetaActual.acertada = true;
        paresEncontrados++;
        
        tarjetaSeleccionada = null;
        tarjetaSeleccionadaIndex = null;
        renderizarTablero();
        
        if (paresEncontrados === totalPares) {
            completarJuego();
        }
    } else {
        bloqueoTablero = true;
        renderizarTablero();
        
        setTimeout(() => {
            tarjetaSeleccionada.volteada = false;
            tarjetaActual.volteada = false;
            tarjetaSeleccionada = null;
            tarjetaSeleccionadaIndex = null;
            bloqueoTablero = false;
            renderizarTablero();
        }, 1000);
    }
}

function completarJuego() {
    if (jugadorActual.completado || juegoTerminado) return;
    
    jugadorActual.completado = true;
    juegoTerminado = true;
    juegoActivo = false;
    
    clearInterval(intervaloReloj);
    intervaloReloj = null;
    
    const tiempoUsado = 90 - tiempoRestante;
    
    const rankingRef = database.ref('ranking');
    rankingRef.push({
        nombre: jugadorActual.nombre,
        tiempo: tiempoUsado,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    });
    
    database.ref(`jugadores/${jugadorActual.id}`).update({ completado: true });
    database.ref('estado/juegoActivo').set(false);
    
    mensajeVictoria.classList.add('mostrar');
}

function actualizarUI() {
    contadorMovimientos.textContent = movimientos;
    paresEncontradosSpan.textContent = paresEncontrados;
}

function escucharRanking() {
    const rankingRef = database.ref('ranking');
    
    rankingRef.orderByChild('tiempo').limitToFirst(5).on('value', (snapshot) => {
        const ranking = [];
        snapshot.forEach((child) => {
            ranking.push(child.val());
        });
        
        const items = listaRanking.querySelectorAll('li');
        for (let i = 0; i < 5; i++) {
            if (ranking[i]) {
                items[i].textContent = `${i+1}. ${ranking[i].nombre} - ${ranking[i].tiempo}s`;
            } else {
                items[i].textContent = '---';
            }
        }
    });
}

function reiniciarTodo() {
    if (intervaloReloj) {
        clearInterval(intervaloReloj);
        intervaloReloj = null;
    }
    
    juegoActivo = false;
    juegoTerminado = false;
    
    if (jugadorActual.id) {
        database.ref(`jugadores/${jugadorActual.id}`).remove();
    }
    
    location.reload();
}

// ========== EVENT LISTENERS ==========
btnIngresar.addEventListener('click', ingresarAlJuego);
btnIniciarJuego.addEventListener('click', iniciarJuegoAnfitrion);
btnSalir.addEventListener('click', reiniciarTodo);

inputNombre.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') ingresarAlJuego();
});

// Inicializar escuchadores
escucharJugadores();
escucharInicioJuego();