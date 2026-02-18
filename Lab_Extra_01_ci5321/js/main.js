import * as twgl from 'https://twgljs.org/dist/5.x/twgl-full.module.js';
import { vs, fs } from './shaders.js';
import { createIcosphereData } from './icosphere.js';

// configuración inicial de WebGL
const m4 = twgl.m4;
const gl = document.getElementById("c").getContext("webgl");
const programInfo = twgl.createProgramInfo(gl, [vs, fs]);

// Camara para movernos
const cameraPos = [0, 35, 120];
const cameraTarget = [0, 0, 0];
const cameraSpeed = 22.2;
const keys = {};

// Captura de eventos de teclado para el movimiento
window.addEventListener('keydown', (e) => { keys[e.key.toLowerCase()] = true; });
window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

function updateCamera() {
    // Control de navegación espacial (W,A,S,D para ejes X/Y, Q,E para profundidad Z)
    if (keys['w']) cameraPos[1] += cameraSpeed;
    if (keys['s']) cameraPos[1] -= cameraSpeed;
    if (keys['a']) cameraPos[0] -= cameraSpeed;
    if (keys['d']) cameraPos[0] += cameraSpeed;
    if (keys['e']) cameraPos[2] -= cameraSpeed;
    if (keys['q']) cameraPos[2] += cameraSpeed;
}

// Generacion de estrellas
const stars = [];
const starArrays = createIcosphereData(0); // Icósfera de baja resolución
const starBufferInfo = twgl.createBufferInfoFromArrays(gl, starArrays);

for (let i = 0; i < 3500; i++) {
    stars.push({
        // Posicionamiento aleatorio de unidades
        pos: [(Math.random() - 0.5) * 800, (Math.random() - 0.5) * 800, (Math.random() - 0.5) * 800],
        size: 0.15 + Math.random() * 0.25,
    });
}

// Sistema solar
// type define el comportamiento en el shader (fs)
const objects = [
    { name: "Sol", size: 7.0, color: [1, 0.8, 0, 1], div: 4, dist: 0, speed: 0, type: 1 },
    { name: "Mercurio", size: 0.9, color: [0.7, 0.7, 0.7, 1], div: 2, dist: 12, speed: 1.5, type: 8 },
    { name: "Venus", size: 1.3, color: [0.9, 0.8, 0.6, 1], div: 3, dist: 18, speed: 1.1, type: 2 },
    { name: "Tierra", size: 1.5, color: [0.2, 0.5, 1, 1], div: 3, dist: 24, speed: 0.8, type: 3 },
    { name: "Marte", size: 1.1, color: [0.9, 0.3, 0.2, 1], div: 3, dist: 32, speed: 0.6, type: 7 },
    { name: "Jupiter", size: 4.5, color: [0.8, 0.7, 0.5, 1], div: 4, dist: 55, speed: 0.4, type: 4 },
    { name: "Saturno", size: 3.8, color: [0.8, 0.7, 0.4, 1], div: 4, dist: 75, speed: 0.3, type: 4 },
    { name: "Urano", size: 2.5, color: [0.5, 0.8, 0.9, 1], div: 4, dist: 90, speed: 0.2, type: 9 },
    { name: "Neptuno", size: 2.4, color: [0.2, 0.3, 0.8, 1], div: 4, dist: 105, speed: 0.15, type: 9 }
];

// Creación de buffers de geometría para cada planeta
objects.forEach(obj => {
    obj.bufferInfo = twgl.createBufferInfoFromArrays(gl, createIcosphereData(obj.div));
});

// Buffers adicionales para elementos especiales
const auraBufferInfo = twgl.createBufferInfoFromArrays(gl, createIcosphereData(4));
const ringBufferInfo = twgl.createBufferInfoFromArrays(gl, createIcosphereData(3));
const moonBufferInfo = twgl.createBufferInfoFromArrays(gl, createIcosphereData(2));

// Generacion del cinturon
const asteroids = [];
const asteroidBufferInfo = twgl.createBufferInfoFromArrays(gl, createIcosphereData(0));

for (let i = 0; i < 1000; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 40 + Math.random() * 10; // Distancia del cinturo
    asteroids.push({
        pos: [Math.cos(angle) * radius, (Math.random() - 0.5) * 8, Math.sin(angle) * radius],
        size: 0.1 + Math.random() * 0.3,
        orbitSpeed: 0.05 + Math.random() * 0.1,
        rotSpeedX: (Math.random() - 0.5) * 4.0,
        rotSpeedZ: (Math.random() - 0.5) * 4.0
    });
}

function render(time) {
    time *= 0.001; // Conversión a segundos
    updateCamera();

    // Ajustes de pantalla y limpieza de buffers
    twgl.resizeCanvasToDisplaySize(gl.canvas);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Configuración de matrices de proyección y vista
    const projection = m4.perspective(45 * Math.PI / 180, gl.canvas.width / gl.canvas.height, 0.1, 2000);
    const cameraMatrix = m4.lookAt(cameraPos, cameraTarget, [0, 1, 0]);
    const viewProjection = m4.multiply(projection, m4.inverse(cameraMatrix));

    gl.useProgram(programInfo.program);

    // Renderizado de estralla
    stars.forEach(star => {
        let world = m4.translate(m4.identity(), star.pos);
        world = m4.scale(world, [star.size, star.size, star.size]);
        twgl.setBuffersAndAttributes(gl, programInfo, starBufferInfo);
        twgl.setUniforms(programInfo, {
            u_worldViewProjection: m4.multiply(viewProjection, world),
            u_worldInverseTranspose: m4.transpose(m4.inverse(world)),
            u_type: 0, // parpadeo
            u_color: [1, 1, 1, 1],
            u_time: time
        });
        twgl.drawBufferInfo(gl, starBufferInfo);
    });

    // Renderizado de planetas y efectos
    objects.forEach(obj => {
        // Cálculo de la órbita (Rotación y luego traslación)
        let orbit = m4.rotateY(m4.identity(), time * obj.speed);
        orbit = m4.translate(orbit, [obj.dist, 0, 0]);
        let planetPosMatrix = orbit; // Guardamos la posición para los satélites

        // Rotación propia del planeta sobre su eje
        let world = m4.rotateY(orbit, time * 0.5);
        let modelScale = m4.scale(world, [obj.size, obj.size, obj.size]);

        twgl.setBuffersAndAttributes(gl, programInfo, obj.bufferInfo);
        twgl.setUniforms(programInfo, {
            u_worldViewProjection: m4.multiply(viewProjection, modelScale),
            u_worldInverseTranspose: m4.transpose(m4.inverse(modelScale)),
            u_color: obj.color,
            u_type: obj.type,
            u_time: time,
        });
        twgl.drawBufferInfo(gl, obj.bufferInfo);

        // Logica de la luna
        if (obj.name === "Tierra") {
            let moonOrbit = m4.rotateY(planetPosMatrix, time * 2.5); // Órbita rápida
            let moonWorld = m4.translate(moonOrbit, [3.0, 0, 0]);
            moonWorld = m4.scale(moonWorld, [0.4, 0.4, 0.4]);

            twgl.setBuffersAndAttributes(gl, programInfo, moonBufferInfo);
            twgl.setUniforms(programInfo, {
                u_worldViewProjection: m4.multiply(viewProjection, moonWorld),
                u_worldInverseTranspose: m4.transpose(m4.inverse(moonWorld)),
                u_type: 8, // Usa shader de tipo Luna/Cráteres
                u_time: time,
                u_color: [0.8, 0.8, 0.8, 1]
            });
            twgl.drawBufferInfo(gl, moonBufferInfo);
        }

        // sol y su aura
        if (obj.name === "Sol") {
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            gl.depthMask(false); // Desactiva escritura en buffer de profundidad para el aura
            let auraWorld = m4.scale(planetPosMatrix, [obj.size * 1.2, obj.size * 1.2, obj.size * 1.2]);
            twgl.setBuffersAndAttributes(gl, programInfo, auraBufferInfo);
            twgl.setUniforms(programInfo, {
                u_worldViewProjection: m4.multiply(viewProjection, auraWorld),
                u_worldInverseTranspose: m4.transpose(m4.inverse(auraWorld)),
                u_type: 6, // Tipo Aura
                u_time: time,
                u_color: [1, 1, 1, 1]
            });
            twgl.drawBufferInfo(gl, auraBufferInfo);
            gl.depthMask(true);
            gl.disable(gl.BLEND);
        }

        // saturno anillo
        if (obj.name === "Saturno") {
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            let ringWorld = m4.rotateX(planetPosMatrix, Math.PI / 4); // Inclinación del anillo
            ringWorld = m4.scale(ringWorld, [obj.size * 2.0, 0.05, obj.size * 2.0]); // Escala plana
            twgl.setBuffersAndAttributes(gl, programInfo, ringBufferInfo);
            twgl.setUniforms(programInfo, {
                u_worldViewProjection: m4.multiply(viewProjection, ringWorld),
                u_worldInverseTranspose: m4.transpose(m4.inverse(ringWorld)),
                u_type: 5, // Tipo Anillo
                u_time: time,
                u_color: [0.8, 0.7, 0.5, 1]
            });
            twgl.drawBufferInfo(gl, ringBufferInfo);
            gl.disable(gl.BLEND);
        }
    });

    // Renderizado de asteroides
    asteroids.forEach(ast => {
        let world = m4.rotateY(m4.identity(), time * ast.orbitSpeed);
        world = m4.translate(world, ast.pos);
        world = m4.rotateX(world, time * ast.rotSpeedX); // Rotación caótica
        world = m4.rotateZ(world, time * ast.rotSpeedZ);
        world = m4.scale(world, [ast.size, ast.size, ast.size]);
        twgl.setBuffersAndAttributes(gl, programInfo, asteroidBufferInfo);
        twgl.setUniforms(programInfo, {
            u_worldViewProjection: m4.multiply(viewProjection, world),
            u_worldInverseTranspose: m4.transpose(m4.inverse(world)),
            u_type: 8, // Comparten el shader de superficie rocosa
            u_color: [0.6, 0.5, 0.4, 1],
            u_time: time
        });
        twgl.drawBufferInfo(gl, asteroidBufferInfo);
    });

    requestAnimationFrame(render);
}
requestAnimationFrame(render);