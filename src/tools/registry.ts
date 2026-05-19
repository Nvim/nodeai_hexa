import { readFile } from 'node:fs/promises'
import { join, resolve, normalize } from 'node:path'
import { Type, type Static } from '@sinclair/typebox'
import { Value } from '@sinclair/typebox/value'

const DOCS_DIR = resolve(process.cwd(), 'docs')

const GetWeatherParams = Type.Object({
  city: Type.String({ minLength: 1, description: 'Nom de la ville (ex: Paris, Lyon, Bordeaux)' })
})

const CalculatorParams = Type.Object({
  expression: Type.String({ minLength: 1, description: 'Expression mathématique à évaluer' })
})

const GetDatetimeParams = Type.Object({}, { additionalProperties: true })

const ReadLocalFileParams = Type.Object({
  filename: Type.String({ minLength: 1, description: 'Nom du fichier dans ./docs (ex: "notes.md")' })
})

type ToolName = 'get_weather' | 'calculator' | 'get_datetime' | 'read_local_file'

const toolDescriptions: Record<ToolName, string> = {
  get_weather: 'Retourne la météo actuelle pour une ville. Utilise une API publique.',
  calculator: 'Évalue une expression mathématique simple (ex: "2 + 3 * 4", "sqrt(16)").',
  get_datetime: "Retourne la date et l'heure actuelle.",
  read_local_file: 'Lit le contenu d\'un fichier dans le dossier ./docs du projet.'
}

const argSchemas: Record<ToolName, ReturnType<typeof Type.Object>> = {
  get_weather: GetWeatherParams,
  calculator: CalculatorParams,
  get_datetime: GetDatetimeParams,
  read_local_file: ReadLocalFileParams
}

export const toolDefinitions = (Object.keys(argSchemas) as ToolName[]).map(name => ({
  type: 'function' as const,
  function: {
    name,
    description: toolDescriptions[name],
    parameters: argSchemas[name]
  }
}))

async function get_weather({ city }: Static<typeof GetWeatherParams>): Promise<string> {
  const url = `https://wttr.in/${encodeURIComponent(city)}?format=%C+%t+%h+humidité`
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
  if (!res.ok) throw new Error(`Météo indisponible pour ${city}`)
  return await res.text()
}

function calculator({ expression }: Static<typeof CalculatorParams>): string {
  const safe = /^[\d\s+\-*/().^%,a-z]+$/i
  if (!safe.test(expression)) throw new Error(`Expression non autorisée: ${expression}`)
  const mathFn = new Function(
    'Math',
    `"use strict"; return (${expression
      .replace(/\^/g, '**')
      .replace(/sqrt/g, 'Math.sqrt')
      .replace(/abs/g, 'Math.abs')
      .replace(/floor/g, 'Math.floor')
      .replace(/ceil/g, 'Math.ceil')
      .replace(/round/g, 'Math.round')
      .replace(/pi/gi, 'Math.PI')
    })`
  )
  const result = mathFn(Math) as number
  if (typeof result !== 'number' || !isFinite(result)) throw new Error('Résultat invalide')
  return String(result)
}

function get_datetime(): string {
  return new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })
}

async function read_local_file({ filename }: Static<typeof ReadLocalFileParams>): Promise<string> {
  const target = normalize(join(DOCS_DIR, filename))
  if (!target.startsWith(DOCS_DIR + '/') && target !== DOCS_DIR) {
    throw new Error(`Accès refusé : ${filename} est en dehors de ./docs`)
  }
  const content = await readFile(target, 'utf8')
  return content.slice(0, 4000)
}

const implementations: Record<ToolName, (args: any) => Promise<string> | string> = {
  get_weather,
  calculator,
  get_datetime,
  read_local_file
}

export async function executeTool(name: string, rawArgs: Record<string, unknown>): Promise<string> {
  const toolName = name as ToolName
  const schema = argSchemas[toolName]
  if (!schema) throw new Error(`Tool inconnu: ${name}`)

  if (!Value.Check(schema, rawArgs)) {
    const errors = [...Value.Errors(schema, rawArgs)]
    throw new Error(`Arguments invalides pour ${name}: ${errors.map(e => e.message).join(', ')}`)
  }

  return implementations[toolName](rawArgs)
}