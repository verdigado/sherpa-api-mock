import express from 'express'
import ash from 'express-async-handler'
import { readDataFile } from '../utils.js'
import { profiles, users } from '../db.js'

export const gnetzV2Router = express.Router()

gnetzV2Router.get(
  '/profiles/ids',
  ash(async (req, res) => {
    res.send(profiles.allIds())
  })
)

gnetzV2Router.post(
  '/profiles/list',
  ash(async (req, res) => {
    const { profileIds, userIds } = req.body
    const matched = profiles.byFilters({ profileIds, userIds })

    const allUsers = users.all()
    const roles = await readDataFile('roles.json')
    res.send(buildProfilesResponse(matched, allUsers, roles))
  })
)

gnetzV2Router.post(
  '/profiles',
  ash(async (req, res) => {
    const { id, userId, username, email, privacy } = req.body

    const user = users.byId(userId)
    if (!user) {
      return res
        .status(400)
        .send({ message: 'cannot create profile, user does not exist' })
    }

    let profile
    try {
      profile = profiles.insert({ id, userId, username, email, privacy })
    } catch (err) {
      if (err.code === 'PROFILE_EXISTS') {
        return res.status(400).send({ message: 'user already has profile' })
      }
      throw err
    }

    const roles = await readDataFile('roles.json')
    res.send(mapProfileDto(profile, user, roles))
  })
)

gnetzV2Router.post(
  '/profiles/delete',
  ash(async (req, res) => {
    const { profileIds, userIds } = req.body
    const deleted = profiles.deleteByIdsOrUserIds(profileIds, userIds)
    res.send(deleted)
  })
)

gnetzV2Router.put(
  '/profiles/:profileId',
  ash(async (req, res) => {
    const profileId = req.params.profileId
    const profile = profiles.byId(profileId)
    if (!profile) {
      return res.status(404).send({ message: 'profile not found' })
    }

    const user = users.byId(profile.userId)
    if (!user) {
      return res
        .status(500)
        .send({ message: 'user for profile does not exist' })
    }

    const updated = profiles.update(profileId, req.body)

    const roles = await readDataFile('roles.json')
    res.send(mapProfileDto(updated, user, roles))
  })
)

gnetzV2Router.put(
  '/profiles/:profileId/image',
  ash(async (req, res) => {
    const profileId = req.params.profileId
    const profile = profiles.byId(profileId)
    if (!profile) {
      return res.status(404).send({ message: 'profile not found' })
    }

    const user = users.byId(profile.userId)
    if (!user) {
      return res
        .status(500)
        .send({ message: 'user for profile does not exist' })
    }

    const updated = profiles.setImage(profileId, req.body)

    const roles = await readDataFile('roles.json')
    res.send(mapProfileDto(updated, user, roles))
  })
)

gnetzV2Router.get(
  '/profiles/:profileId/delete-image',
  ash(async (req, res) => {
    const profileId = req.params.profileId
    const profile = profiles.byId(profileId)
    if (!profile) {
      return res.status(404).send({ message: 'profile not found' })
    }

    const user = users.byId(profile.userId)
    if (!user) {
      return res
        .status(500)
        .send({ message: 'user for profile does not exist' })
    }

    const updated = profiles.setImage(profileId, {})

    const roles = await readDataFile('roles.json')
    res.send(mapProfileDto(updated, user, roles))
  })
)

gnetzV2Router.get(
  '/profiles/:profileId/form-values',
  ash(async (req, res) => {
    const profileId = req.params.profileId
    const profile = profiles.byId(profileId)
    if (!profile) {
      return res.status(404).send({ message: 'profile not found' })
    }

    const user = users.byId(profile.userId)
    if (!user) {
      return res
        .status(500)
        .send({ message: 'user for profile does not exist' })
    }

    res.send(user.formValues)
  })
)

gnetzV2Router.get(
  '/tags',
  ash(async (req, res) => {
    const tags = await readDataFile('gnetz-tags.json')
    res.send(tags)
  })
)

function buildProfilesResponse(profiles, users, roles) {
  const items = []
  for (const profile of profiles) {
    const user = users.find((u) => u.id === profile.userId)
    if (!user) {
      throw new Error(
        `no user ${profile.userId} exist for profile ${profile.id}`
      )
    }
    items.push(mapProfileDto(profile, user, roles))
  }
  return items
}

function mapProfileDto(profile, user, roles) {
  const {
    id,
    userId,
    username,
    email,
    privacy,
    image,
    phoneNumbers,
    messengers,
    socialMedia,
    tags,
  } = profile

  const { personalId, name1, name2, achievements, memberships } = user

  const mappedRoles = []
  for (const { roleId } of user.roles) {
    const role = roles.find((r) => r.id === roleId)
    if (!role) {
      console.error(`missing role ${roleId} for mapping`)
      continue
    }
    const rolyTypeMapping = {
      A: 'office',
      B: 'relation',
      M: 'mandate',
      R: 'role',
      S: 'system',
    }
    mappedRoles.push({
      // is is supposed to be the m:n mapping id, but we don't have one
      // it is faked with the roleId plus an offset
      id: (parseInt(role.id, 10) + 1000000000).toString(),
      roleId: parseInt(role.id, 10),
      name: role.label,
      type: rolyTypeMapping[role.type] ?? 'office',
      alias: role.aliases.at(0)?.label ?? 'no alias',
    })
  }

  return {
    id,
    userId,
    firstName: name1,
    lastName: name2,
    personalId,
    username,
    email,
    privacy,
    image,
    phoneNumbers,
    messengers,
    socialMedia,
    tags,
    roles: mappedRoles,
    memberships: memberships.map(({ ownerIdentifier, joinedAt, exitedAt }) => ({
      divisionKey: ownerIdentifier,
      joinedAt,
      exitedAt,
    })),
    achievements,
  }
}
