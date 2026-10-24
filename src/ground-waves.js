import * as THREE from 'three';

// Recycle contact markers so walking never allocates geometry or materials.
export class GroundWaves {
  constructor(scene, reducedMotion = false) {
    this.reducedMotion = reducedMotion;
    this.root = new THREE.Group();
    this.root.name = 'Ondas de contacto podotactil';
    scene.add(this.root);
    this.next = 0;
    const coreGeometry = new THREE.RingGeometry(.94, 1, 64);
    const haloGeometry = new THREE.RingGeometry(.83, 1.10, 64);
    this.contacts = Array.from({ length: 6 }, () => {
      const group = new THREE.Group();
      group.visible = false;
      this.root.add(group);
      const rings = Array.from({ length: 2 }, () => {
        const ring = new THREE.Group();
        ring.rotation.x = -Math.PI / 2;
        for (const [geometry, glow] of [[haloGeometry, true], [coreGeometry, false]]) {
          const material = new THREE.MeshBasicMaterial({
            color: '#f2d46b', transparent: true, opacity: 0,
            blending: THREE.AdditiveBlending, depthWrite: false,
            side: THREE.DoubleSide, fog: false, toneMapped: false
          });
          const mesh = new THREE.Mesh(geometry, material);
          mesh.userData.glow = glow;
          ring.add(mesh);
        }
        group.add(ring);
        return ring;
      });
      return { group, rings, started: -Infinity };
    });
  }

  emit(point, surface, now) {
    if (surface !== 'guide' && surface !== 'warning') return;
    const contact = this.contacts[this.next];
    this.next = (this.next + 1) % this.contacts.length;
    contact.started = now;
    // Sit above both the tile and its raised ribs/dots without shining through walls.
    contact.group.position.set(point.x, Math.max(.09, point.y + .015), point.z);
    contact.group.visible = true;
    for (const ring of contact.rings) {
      ring.visible = false;
      for (const mesh of ring.children) mesh.material.color.set(surface === 'warning' ? '#ffb45b' : '#f2d46b');
    }
  }

  update(now, visible) {
    this.root.visible = visible;
    const duration = this.reducedMotion ? 650 : 1250;
    for (const contact of this.contacts) {
      const age = now - contact.started;
      contact.group.visible = age >= 0 && age < duration + (this.reducedMotion ? 0 : 180);
      if (!contact.group.visible) continue;
      contact.rings.forEach((ring, index) => {
        const progress = (age - index * 180) / duration;
        ring.visible = progress >= 0 && progress < 1 && (!this.reducedMotion || index === 0);
        if (!ring.visible) return;
        const radius = this.reducedMotion ? .25 : .06 + .78 * (1 - (1 - progress) ** 2);
        ring.scale.setScalar(radius);
        const opacity = .9 * (1 - progress) ** 1.5;
        for (const mesh of ring.children) mesh.material.opacity = opacity * (mesh.userData.glow ? .22 : 1);
      });
    }
  }

  clear() {
    for (const contact of this.contacts) {
      contact.started = -Infinity;
      contact.group.visible = false;
    }
  }
}
