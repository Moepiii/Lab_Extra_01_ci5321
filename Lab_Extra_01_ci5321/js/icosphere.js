/**
 GENERACIÓN DE ICOESFERA 
 la Icoesfera divide sus caras uniformemente, evitando la acumulación de triángulos en los polos. 
 **/
export function createIcosphereData(subdivisions) {
    // vértices iniciales de un icosaedro regular
    const t = (1.0 + Math.sqrt(5.0)) / 2.0;

    //  Vertices iniciales
    let vertices = [
        [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
        [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
        [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]
    ].map(v => normalize(v)); 

    //  Caras iniciales
    let faces = [
        [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
        [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
        [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
        [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]
    ];

    const cache = {}; // Cache para evitar duplicar vértices al subdividir aristas

    //Calcula el punto medio entre dos vértices y lo proyecta a la superficie de la esfera.
    function getMiddlePoint(p1, p2) {
        const key = p1 < p2 ? `${p1}_${p2}` : `${p2}_${p1}`;
        if (cache[key]) return cache[key];

        const v1 = vertices[p1], v2 = vertices[p2];
        const middle = normalize([
            (v1[0] + v2[0]) / 2,
            (v1[1] + v2[1]) / 2,
            (v1[2] + v2[2]) / 2
        ]);

        vertices.push(middle);
        return cache[key] = vertices.length - 1;
    }

    /** Subdivisiones parametrizadas
     Por cada nivel de subdivisión, cada triángulo se divide en 4 triángulos nuevos. Esto aumenta el detalle de la malla.**/
    for (let i = 0; i < subdivisions; i++) {
        const facesRender = [];
        faces.forEach(([a, b, c]) => {
            const ab = getMiddlePoint(a, b);
            const bc = getMiddlePoint(b, c);
            const ca = getMiddlePoint(c, a);

            // Crea 4 nuevos triángulos a partir de uno
            facesRender.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
        });
        faces = facesRender;
    }

    //Función matemática para asegurar que cada punto esté a la misma distancia del centro.
    function normalize(v) {
        const d = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
        return [v[0] / d, v[1] / d, v[2] / d];
    }

    // Retorno de atributos vertices
    // Se devuelven los datos estructurados para TWGL.
    return {
        // Coordenadas 3D (x, y, z)
        position: { numComponents: 3, data: vertices.flat() },
        // Vectores normales para iluminación intente que estuvuera siempre iluminada pero siempre me quedo una parte oscura.
        // En una esfera centrada en el origen, la normal es igual a la posición normalizada.
        normal: { numComponents: 3, data: vertices.flat() },
        // Índices que conectan los vértices para formar los triángulos
        indices: { numComponents: 3, data: faces.flat() },
    };
}