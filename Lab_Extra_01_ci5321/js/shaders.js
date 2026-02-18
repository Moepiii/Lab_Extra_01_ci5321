export const vs = `
  precision mediump float;
  precision mediump int;

  // Atributos de entrada de la malla
  attribute vec4 position;
  attribute vec3 normal;

  // Uniforms de control
  uniform mat4 u_worldViewProjection;    // Matriz de transformación total
  uniform mat4 u_worldInverseTranspose;  // Matriz para transformar normales correctamente
  uniform float u_time;
  uniform int u_type;                    // Identificador del tipo de astro

  // Salidas para el fragment shader
  varying vec3 v_normal;
  varying vec3 v_position;
  varying float v_noise;

  // Función Hash: Genera valores pseudo-aleatorios basados en coordenadas 3D
  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  // Ruido de valor: Interpola suavemente entre valores aleatorios de la rejilla
  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f); // Suavizado Hermite
    return mix(mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
                   mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                   mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }

  void main() {
    vec3 pos = position.xyz;
    v_noise = 0.0;

    // Efecto para el sol (Type 6 - el destello solar)
    if (u_type == 6) {
      // Crea protuberancias solares dinámicas moviendo los vértices según el ruido
      float n = noise(pos * 14.0 + u_time * 0.4);
      v_noise = pow(n, 15.5); // Aísla picos de ruido muy intensos
      pos += normal * (v_noise * 0.6); // Desplaza el vértice en dirección de su normal
    }

    gl_Position = u_worldViewProjection * vec4(pos, 1.0);
    // Transforma las normales al espacio del mundo/cámara
    v_normal = (u_worldInverseTranspose * vec4(normal, 0.0)).xyz;
    v_position = pos;
  }
`;

export const fs = `
  precision mediump float;
  precision mediump int;

  varying vec3 v_normal;
  varying vec3 v_position;
  varying float v_noise;

  uniform vec4 u_color;
  uniform float u_time;
  uniform int u_type; 

  // Funciones de ruido idénticas al VS para consistencia visual
  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
                   mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                   mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }

  // Superpone capas de ruido para detalle orgánico
  float fbm(vec3 x) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 6; i++) {
      v += a * noise(x);
      x = x * 2.0;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec3 normal = normalize(v_normal);
    // Dirección de luz estática
    vec3 lightDir = normalize(vec3(0.5, 0.2, 1.0)); 
    float light = max(dot(normal, lightDir), 0.05); // Lambert simple con luz ambiente mínima
    
    //Brillo en el agua/anillos
    vec3 viewDir = normalize(vec3(0,0,1));
    vec3 reflectDir = reflect(-lightDir, normal);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), 32.0);

    if (u_type == 0) { // parpadeo estelar o intento de porque no se ve mucho
      // Usa funciones seno basadas en posición para que no parpadeen todas al unísono
      float sparkle = sin(u_time * 4.0 + v_position.x * 20.0 + v_position.y * 30.0) * 0.5 + 0.5;
      float brightness = mix(0.4, 1.0, sparkle);
      gl_FragColor = vec4(u_color.rgb * brightness, 1.0);

    } else if (u_type == 1) { // SOL
      // Mezcla de dos colores de fuego basados en ruido animado
      float n = noise(v_position * 3.0 + u_time * 0.5);
      vec3 fire1 = vec3(1.0, 0.9, 0.1);
      vec3 fire2 = vec3(1.0, 0.4, 0.0);
      gl_FragColor = vec4(mix(fire1, fire2, n), 1.0);

    } else if (u_type == 6) { // AURA
      // efecto Fresnel basado en el ángulo de visión
      float glow = pow(1.1 - abs(dot(normal, vec3(0,0,1))), 3.0);
      vec3 auraColor = mix(vec3(1.0, 0.5, 0.1), vec3(1.0, 0.9, 0.6), v_noise);
      gl_FragColor = vec4(auraColor, (glow + v_noise * 0.5) * 0.6);

    } else if (u_type == 3) { // TIERRA
        float n = fbm(v_position * 4.5);
        float isWater = step(n, 0.52); // Determina qué es tierra y qué es agua
        vec3 waterColor = vec3(0.0, 0.25, 0.6) + (spec * 0.8 * isWater); // El agua tiene reflejo
        vec3 landColor = vec3(0.1, 0.5, 0.2) * light;
        vec3 planetBase = mix(landColor, waterColor * light, isWater);
        
        // Capa de nubes moviéndose lateralmente
        float cloudNoise = fbm(v_position * 4.0 + vec3(u_time * 0.08, 0.0, 0.0));
        float clouds = smoothstep(0.45, 0.65, cloudNoise);
        vec3 finalColor = mix(planetBase, vec3(1.0), clouds * 0.9);
        
        // Atmósfera azulada en los bordes
        float atm = pow(1.0 - dot(normal, vec3(0,0,1)), 3.0);
        gl_FragColor = vec4(finalColor + vec3(0.0, 0.4, 1.0) * atm * 0.4, 1.0);
        
    } else if (u_type == 2) { // VENUS
       // Efecto de nubes densas 
       float n = fbm(v_position * 3.5 + u_time * 0.05);
       vec3 c1 = vec3(0.95, 0.9, 0.7); 
       vec3 c2 = vec3(0.85, 0.5, 0.2); 
       gl_FragColor = vec4(mix(c1, c2, n) * light, 1.0);

    } else if (u_type == 4) { // JÚPITER y SATURNO
      // Bandas horizontales distorsionadas por ruido para simular turbulencia
      float turb = noise(v_position * 6.0 + u_time * 0.1) * 0.4;
      float bands = sin((v_position.y + turb) * 18.0);
      vec3 col = mix(u_color.rgb, u_color.rgb * 0.4, bands * 0.5 + 0.5);
      gl_FragColor = vec4(col * light, 1.0);

    } else if (u_type == 7) { // MARTE
       // tonos rojizos y oscuros para simular terreno rocoso
       float n = fbm(v_position * 8.0); 
       vec3 redDust = u_color.rgb;
       vec3 darkRock = vec3(0.35, 0.1, 0.05);
       vec3 surface = mix(redDust, darkRock, smoothstep(0.35, 0.75, n));
       gl_FragColor = vec4(surface * light, 1.0);

    } else if (u_type == 8) { // MERCURIO y LUNA
       // Ruido de alta frecuencia para simular cráteres y superficie irregular
       float n = noise(v_position * 20.0); 
       float craters = smoothstep(0.4, 0.55, n); 
       vec3 base = vec3(0.7, 0.7, 0.7);
       vec3 hole = vec3(0.4, 0.4, 0.4);
       gl_FragColor = vec4(mix(base, hole, craters) * light, 1.0);

    } else if (u_type == 9) { // URANO y NEPTUNO
       // gaseosos suaves con un ligero resplandor
       float cloudNoise = fbm(v_position * 3.0 + vec3(u_time * 0.15, 0.0, 0.0));
       vec3 baseColor = u_color.rgb;
       vec3 lighterGas = baseColor + vec3(0.2);
       float atmosphere = pow(1.0 - dot(normal, vec3(0,0,1)), 2.5);
       vec3 color = mix(baseColor, lighterGas, cloudNoise) * light;
       gl_FragColor = vec4(color + (atmosphere * vec3(0.5, 0.9, 1.0) * 0.5), 1.0);

    } else if (u_type == 5) { // ANILLO
      // Genera surcos 
      float dist = length(v_position.xz);
      float bands = sin(dist * 60.0) * 0.5 + 0.5;
      float dust = noise(v_position * 40.0); // Añade granularidad de partículas
      gl_FragColor = vec4(u_color.rgb * bands * (0.8 + dust * 0.4), 0.9);

    } else { 
      // Comportamiento por defecto para cualquier otro objeto
      gl_FragColor = vec4(u_color.rgb * light, u_color.a);
    }
  }
`;