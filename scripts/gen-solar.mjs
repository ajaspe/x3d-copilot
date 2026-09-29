/** Generate public/examples/solar-system.x3d: six planets, Saturn's rings, a moon, and a 500-point star field. */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "examples", "solar-system.x3d");
let seed = 42;
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const pts = [];
for (let i = 0; i < 500; i++) {
  const z = rnd() * 2 - 1, t = rnd() * Math.PI * 2, r = Math.sqrt(1 - z * z), R = 80;
  pts.push([R * r * Math.cos(t), R * z, R * r * Math.sin(t)].map((v) => v.toFixed(1)).join(" "));
}
const spin = (def) => `<OrientationInterpolator DEF="${def}" key="0 0.5 1" keyValue="0 1 0 0  0 1 0 3.14159  0 1 0 6.28318"/>`;
const planet = (name, dist, radius, color, period, extra = "") => `
    <!-- ${name}: orbit radius ${dist}, period ${period}s -->
    <Transform DEF="${name}Orbit">
      <Transform translation="${dist} 0 0">
        <Shape>
          <Appearance><Material diffuseColor="${color}"/></Appearance>
          <Sphere radius="${radius}"/>
        </Shape>${extra}
      </Transform>
    </Transform>
    <TimeSensor DEF="${name}Clock" cycleInterval="${period}" loop="true"/>
    ${spin(name + "Spin")}
    <ROUTE fromNode="${name}Clock" fromField="fraction_changed" toNode="${name}Spin" toField="set_fraction"/>
    <ROUTE fromNode="${name}Spin" fromField="value_changed" toNode="${name}Orbit" toField="set_rotation"/>`;
const ring = (r) => `
        <Transform rotation="1 0 0 1.5708">
          <Shape>
            <Appearance><Material emissiveColor="0.3 0.3 0.4"/></Appearance>
            <Circle2D radius="${r}"/>
          </Shape>
        </Transform>`;
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<X3D profile="Immersive" version="4.0" xmlns:xsd="http://www.w3.org/2001/XMLSchema-instance" xsd:noNamespaceSchemaLocation="https://www.web3d.org/specifications/x3d-4.0.xsd">
  <head>
    <meta name="title" content="solar-system.x3d"/>
    <meta name="description" content="Nested Transforms: six planets orbit the sun at their own periods, the moon orbits the earth, all under a PointSet star field. Each orbit has its own TimeSensor."/>
    <meta name="generator" content="X3D Copilot"/>
  </head>
  <Scene>
    <WorldInfo title="Solar system"/>
    <NavigationInfo type='"EXAMINE" "ANY"' headlight="false"/>
    <Background skyColor="0 0 0.02"/>
    <Viewpoint description="Above the ecliptic" position="0 14 24" orientation="1 0 0 -0.5"/>
    <Viewpoint description="Edge on" position="0 1 30"/>

    <!-- Stars: 500 points on a distant sphere -->
    <Shape>
      <Appearance>
        <Material emissiveColor="1 1 1"/>
        <PointProperties pointSizeScaleFactor="1.5"/>
      </Appearance>
      <PointSet>
        <Coordinate point="${pts.join("  ")}"/>
      </PointSet>
    </Shape>

    <!-- Sun: emissive, and the only light source -->
    <PointLight DEF="SunLight" location="0 0 0" intensity="2" radius="80" ambientIntensity="0.1"/>
    <Transform DEF="SunSpin">
      <Shape>
        <Appearance>
          <Material diffuseColor="1 0.6 0.1" emissiveColor="1 0.55 0.05"/>
        </Appearance>
        <Sphere radius="1.6"/>
      </Shape>
    </Transform>
    <TimeSensor DEF="SunClock" cycleInterval="40" loop="true"/>
    ${spin("SunRot")}
    <ROUTE fromNode="SunClock" fromField="fraction_changed" toNode="SunRot" toField="set_fraction"/>
    <ROUTE fromNode="SunRot" fromField="value_changed" toNode="SunSpin" toField="set_rotation"/>
${planet("Mercury", 3, 0.18, "0.6 0.55 0.5", 6)}${planet("Venus", 4.3, 0.3, "0.9 0.75 0.45", 10)}
    <!-- Earth orbit, with the moon nested in the earth's frame -->
    <Transform DEF="EarthOrbit">
      <Transform translation="6 0 0">
        <Transform DEF="EarthSpin">
          <Shape>
            <Appearance>
              <Material diffuseColor="0.15 0.4 0.9" specularColor="0.4 0.4 0.5" shininess="0.4"/>
            </Appearance>
            <Sphere radius="0.4"/>
          </Shape>
        </Transform>
        <Transform DEF="MoonOrbit">
          <Transform translation="0.9 0 0">
            <Shape>
              <Appearance>
                <Material diffuseColor="0.75 0.75 0.7"/>
              </Appearance>
              <Sphere radius="0.11"/>
            </Shape>
          </Transform>
        </Transform>
      </Transform>
    </Transform>
    <TimeSensor DEF="YearClock" cycleInterval="16" loop="true"/>
    <TimeSensor DEF="MonthClock" cycleInterval="2.5" loop="true"/>
    <TimeSensor DEF="DayClock" cycleInterval="3" loop="true"/>
    ${spin("Spin")}
    <ROUTE fromNode="YearClock" fromField="fraction_changed" toNode="Spin" toField="set_fraction"/>
    <ROUTE fromNode="Spin" fromField="value_changed" toNode="EarthOrbit" toField="set_rotation"/>
    ${spin("MoonSpin")}
    <ROUTE fromNode="MonthClock" fromField="fraction_changed" toNode="MoonSpin" toField="set_fraction"/>
    <ROUTE fromNode="MoonSpin" fromField="value_changed" toNode="MoonOrbit" toField="set_rotation"/>
    ${spin("EarthDay")}
    <ROUTE fromNode="DayClock" fromField="fraction_changed" toNode="EarthDay" toField="set_fraction"/>
    <ROUTE fromNode="EarthDay" fromField="value_changed" toNode="EarthSpin" toField="set_rotation"/>
${planet("Mars", 8, 0.25, "0.85 0.35 0.2", 26)}${planet("Jupiter", 11.5, 0.9, "0.8 0.65 0.5", 50)}${planet("Saturn", 15, 0.75, "0.85 0.75 0.5", 75, ring(1.25) + ring(1.45))}
    <!-- Orbit guide rings -->
    <Transform rotation="1 0 0 1.5708">
      <Shape>
        <Appearance><Material emissiveColor="0.2 0.2 0.3"/></Appearance>
        <Circle2D radius="6"/>
      </Shape>
      <Shape>
        <Appearance><Material emissiveColor="0.15 0.15 0.22"/></Appearance>
        <Circle2D radius="11.5"/>
      </Shape>
      <Shape>
        <Appearance><Material emissiveColor="0.15 0.15 0.22"/></Appearance>
        <Circle2D radius="15"/>
      </Shape>
    </Transform>
  </Scene>
</X3D>
`;
writeFileSync(out, xml);
console.log("written", xml.split("\n").length, "lines");
