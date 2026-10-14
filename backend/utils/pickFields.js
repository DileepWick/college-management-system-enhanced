const PRIMITIVE_TYPES = ["string", "number", "boolean"];
const EMERGENCY_CONTACT_FIELDS = ["name", "relationship", "phone"];

// Copies only allowlisted fields from untrusted input. Values must be primitives
// so operator objects such as { "$gt": "" } never reach a Mongo query or update.
const pickFields = (source, allowedFields) => {
  const picked = {};
  if (!source || typeof source !== "object") {
    return picked;
  }

  for (const field of allowedFields) {
    // multer builds req.body with a null prototype, so call hasOwnProperty directly
    if (!Object.prototype.hasOwnProperty.call(source, field)) continue;
    if (PRIMITIVE_TYPES.includes(typeof source[field])) {
      picked[field] = source[field];
    }
  }

  return picked;
};

// Profile forms send flat fields plus a nested emergencyContact object
const pickProfileFields = (body, allowedFields) => {
  const picked = pickFields(body, allowedFields);
  const emergencyContact = pickFields(
    body?.emergencyContact,
    EMERGENCY_CONTACT_FIELDS
  );

  if (Object.keys(emergencyContact).length > 0) {
    picked.emergencyContact = emergencyContact;
  }

  return picked;
};

module.exports = { pickFields, pickProfileFields };
