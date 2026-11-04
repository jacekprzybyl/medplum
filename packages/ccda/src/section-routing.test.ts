// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import type { Bundle } from '@medplum/fhirtypes';
import type { CcdaToFhirOptions } from './ccda-to-fhir';
import { convertCcdaToFhir } from './ccda-to-fhir';
import { convertXmlToCcda } from './xml';

const MEDICATION_ENTRY = `
  <entry typeCode="DRIV">
    <substanceAdministration classCode="SBADM" moodCode="EVN">
      <templateId root="2.16.840.1.113883.10.20.22.4.16" extension="2014-06-09"/>
      <id root="2.16.840.1.113883.19.5" extension="MED-1"/>
      <statusCode code="active"/>
      <effectiveTime xsi:type="IVL_TS"><low value="20250101"/></effectiveTime>
      <consumable>
        <manufacturedProduct classCode="MANU">
          <templateId root="2.16.840.1.113883.10.20.22.4.23" extension="2014-06-09"/>
          <manufacturedMaterial>
            <code code="310793" codeSystem="2.16.840.1.113883.6.88" displayName="Examplamide 10 MG Oral Tablet"/>
          </manufacturedMaterial>
        </manufacturedProduct>
      </consumable>
    </substanceAdministration>
  </entry>`;

const PROBLEM_ENTRY = `
  <entry typeCode="DRIV">
    <act classCode="ACT" moodCode="EVN">
      <templateId root="2.16.840.1.113883.10.20.22.4.3" extension="2015-08-01"/>
      <id root="2.16.840.1.113883.19.5" extension="PROB-1"/>
      <code code="CONC" codeSystem="2.16.840.1.113883.5.6"/>
      <statusCode code="active"/>
      <entryRelationship typeCode="SUBJ">
        <observation classCode="OBS" moodCode="EVN">
          <templateId root="2.16.840.1.113883.10.20.22.4.4" extension="2015-08-01"/>
          <id root="2.16.840.1.113883.19.5" extension="PROB-1-OBS"/>
          <code code="55607006" codeSystem="2.16.840.1.113883.6.96" displayName="Problem"/>
          <statusCode code="completed"/>
          <value xsi:type="CD" code="38341003" codeSystem="2.16.840.1.113883.6.96" displayName="Hypertensive disorder"/>
        </observation>
      </entryRelationship>
    </act>
  </entry>`;

function convertSection(sectionXml: string, options?: CcdaToFhirOptions): Bundle {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ClinicalDocument xmlns="urn:hl7-org:v3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <recordTarget>
    <patientRole>
      <patient>
        <name use="L"><given>Test</given><family>Patient</family></name>
      </patient>
    </patientRole>
  </recordTarget>
  <component>
    <structuredBody>
      <component>
        <section>
          ${sectionXml}
        </section>
      </component>
    </structuredBody>
  </component>
</ClinicalDocument>`;
  return convertCcdaToFhir(convertXmlToCcda(xml), options);
}

// The resource types converted from the section's entries (the Composition and Patient are always present)
function resourceTypes(bundle: Bundle): string[] {
  return (bundle.entry ?? [])
    .map((e) => e.resource?.resourceType as string)
    .filter((t) => t !== 'Composition' && t !== 'Patient');
}

describe('section routing', () => {
  test('routes a Medications section whose handled template is not listed first', () => {
    const bundle = convertSection(`
      <templateId root="2.16.840.1.113883.10.20.22.2.1"/>
      <templateId root="2.16.840.1.113883.10.20.22.2.1" extension="2014-06-09"/>
      <templateId root="2.16.840.1.113883.10.20.22.2.1.1"/>
      <templateId root="2.16.840.1.113883.10.20.22.2.1.1" extension="2014-06-09"/>
      <code code="10160-0" codeSystem="2.16.840.1.113883.6.1"/>
      ${MEDICATION_ENTRY}`);
    expect(resourceTypes(bundle)).toEqual(['MedicationRequest']);
  });

  test('routes a Medications section that lists only the entries-optional template', () => {
    const bundle = convertSection(`
      <templateId root="2.16.840.1.113883.10.20.22.2.1" extension="2014-06-09"/>
      <code code="10160-0" codeSystem="2.16.840.1.113883.6.1"/>
      ${MEDICATION_ENTRY}`);
    expect(resourceTypes(bundle)).toEqual(['MedicationRequest']);
  });

  test('routes a Problems section whose handled template follows an unknown one', () => {
    const bundle = convertSection(`
      <templateId root="1.2.840.114350.1.72.1.2.5"/>
      <templateId root="2.16.840.1.113883.10.20.22.2.5.1" extension="2015-08-01"/>
      <code code="11450-4" codeSystem="2.16.840.1.113883.6.1"/>
      ${PROBLEM_ENTRY}`);
    expect(resourceTypes(bundle)).toEqual(['Condition']);
  });

  test('routes a Problems section that lists the V2 entries-required template', () => {
    const bundle = convertSection(`
      <templateId root="2.16.840.1.113883.10.20.22.2.5.1.2"/>
      <code code="11450-4" codeSystem="2.16.840.1.113883.6.1"/>
      ${PROBLEM_ENTRY}`);
    expect(resourceTypes(bundle)).toEqual(['Condition']);
  });

  test('still rejects a section none of whose templates is handled', () => {
    const sectionXml = `
      <templateId root="9.9.9999"/>
      <templateId root="9.9.9998"/>
      <code code="10160-0" codeSystem="2.16.840.1.113883.6.1"/>
      ${MEDICATION_ENTRY}`;
    expect(() => convertSection(sectionXml)).toThrow('Unhandled substance administration templateId: 9.9.9999');
    expect(resourceTypes(convertSection(sectionXml, { ignoreUnsupportedSections: true }))).toEqual([]);
  });
});
