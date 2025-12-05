/**
 * Persona Configuration Store
 * DB에서 페르소나 설정을 가져오는 진입점
 */

import { PersonaConfig } from '../../../types/persona-engine';
import { getPersonaConfigFromDB, getFullPersonaData as getFullPersonaDataFromService, PersonaCoreData } from './persona-config-service';

/**
 * 페르소나 설정 가져오기 (DB에서 조회)
 */
export async function getPersonaConfig(personaId: string): Promise<PersonaConfig | null> {
  return getPersonaConfigFromDB(personaId);
}

/**
 * 페르소나 전체 데이터 가져오기 (DB에서 조회)
 */
export async function getFullPersonaData(personaId: string): Promise<PersonaCoreData | null> {
  return getFullPersonaDataFromService(personaId);
}

// Re-export types
export type { PersonaCoreData } from './persona-config-service';
