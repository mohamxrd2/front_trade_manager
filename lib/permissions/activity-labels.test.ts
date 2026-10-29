import { describe, expect, test } from 'vitest'
import { activityActionLabelKey } from './activity-labels'

describe('activityActionLabelKey — actions connues de activity_logs (chantier "Équipe" §4)', () => {
  test('action connue : clé de traduction team.activityAction.*', () => {
    expect(activityActionLabelKey('team.member_suspended')).toBe('team.activityAction.team.member_suspended')
    expect(activityActionLabelKey('team.member_login')).toBe('team.activityAction.team.member_login')
  })

  test('action inconnue : null (repli sur la valeur brute côté appelant)', () => {
    expect(activityActionLabelKey('some.unknown.action')).toBeNull()
  })
})
