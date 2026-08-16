// Shrinks the stadium GLB for mobile: halves every atlas (4096→2048,
// 2048→1024), re-encodes WebP, and re-applies Draco. Node names and the
// stand-root hierarchy are untouched — the site depends on them.
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS, KHRDracoMeshCompression } from '@gltf-transform/extensions'
import { textureCompress } from '@gltf-transform/functions'
import draco3d from 'draco3dgltf'
import sharp from 'sharp'

const [, , input = 'public/models/old-trafford.glb', output = input] = process.argv

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    'draco3d.decoder': await draco3d.createDecoderModule(),
    'draco3d.encoder': await draco3d.createEncoderModule(),
  })

const doc = await io.read(input)

// Halve each texture relative to its own current size.
for (const tex of doc.getRoot().listTextures()) {
  const size = tex.getSize()
  if (!size) continue
  const [w, h] = size
  const target = Math.max(512, Math.floor(w / 2))
  await doc.transform(
    textureCompress({
      encoder: sharp,
      targetFormat: 'webp',
      quality: 82,
      resize: [target, Math.max(512, Math.floor(h / 2))],
      pattern: new RegExp(`^${tex.getName().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`),
    }),
  )
  console.log(`${tex.getName()}: ${w}x${h} -> ${tex.getSize()?.join('x')}`)
}

doc.createExtension(KHRDracoMeshCompression)
  .setRequired(true)
  .setEncoderOptions({
    method: KHRDracoMeshCompression.EncoderMethod.EDGEBREAKER,
    quantizationBits: { POSITION: 11, TEX_COORD: 12 },
  })

await io.write(output, doc)
console.log('written', output)
