import { GoogleGenAI, Type } from "@google/genai";
import type { DocumentData, CoverageData, MedicalData, SubLimitCategory } from "./adjudicationEngine";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "dummy" });

export interface ExtractedBillData {
  document: Omit<DocumentData, "submissionDate" | "patientNameOnPolicy" | "ageOnPolicy">;
  coverage: Omit<CoverageData, "providerIsInNetwork" | "providerIsBlacklisted" | "preAuthRequired" | "preAuthObtained">;
  medical: MedicalData;
  billTotal: number;
}

export async function parseMedicalBill(
  fileBuffer: Buffer,
  mimeType: string
): Promise<ExtractedBillData> {
  if (!process.env.GEMINI_API_KEY) {
    console.warn("GEMINI_API_KEY not set. Using mocked response.");
    return getMockExtractedData();
  }

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      document: {
        type: Type.OBJECT,
        properties: {
          ocrConfidence: { type: Type.NUMBER, description: "Estimated legibility score of the document from 0.0 to 1.0" },
          hasPrescription: { type: Type.BOOLEAN, description: "Whether a doctor's prescription is present" },
          prescriptionIsValid: { type: Type.BOOLEAN, description: "Whether prescription has signature, date, and doctor details" },
          doctorRegNumber: { type: Type.STRING, description: "Doctor's medical registration number if present (e.g. MH/12345/2018)" },
          hasStampAndHeader: { type: Type.BOOLEAN, description: "Whether the bill has an official hospital stamp or letterhead" },
          serviceDate: { type: Type.STRING, description: "Main date of service in YYYY-MM-DD format" },
          documentDates: { type: Type.ARRAY, items: { type: Type.STRING }, description: "All dates found in the document (YYYY-MM-DD)" },
          patientNameOnDoc: { type: Type.STRING, description: "Name of the patient on the document" },
        },
        required: ["ocrConfidence", "hasPrescription", "prescriptionIsValid", "hasStampAndHeader", "serviceDate", "documentDates", "patientNameOnDoc"],
      },
      coverage: {
        type: Type.OBJECT,
        properties: {
          diagnosisCodes: { type: Type.ARRAY, items: { type: Type.STRING }, description: "ICD-10 codes inferred from diagnosis. E.g. J06.9" },
          procedureCodes: { type: Type.ARRAY, items: { type: Type.STRING }, description: "CPT or procedure codes if any" },
          serviceCategory: { 
            type: Type.STRING, 
            description: "Category of service: consultation, pharmacy, diagnostics, physiotherapy, dental, vision, emergency, specialist, surgery, other" 
          },
        },
        required: ["diagnosisCodes", "procedureCodes", "serviceCategory"],
      },
      medical: {
        type: Type.OBJECT,
        properties: {
          diagnosisJustifiesTreatment: { type: Type.BOOLEAN, description: "Does the diagnosis clinically justify the treatment/items billed?" },
          prescriptionMatchesDiagnosis: { type: Type.BOOLEAN, description: "Do prescribed medications match the condition?" },
          followsStandardProtocol: { type: Type.BOOLEAN, description: "Is this standard medical protocol?" },
          isExperimental: { type: Type.BOOLEAN, description: "Is this experimental or unproven treatment?" },
          isCosmetic: { type: Type.BOOLEAN, description: "Is this a cosmetic or aesthetic procedure?" },
        },
        required: ["diagnosisJustifiesTreatment", "prescriptionMatchesDiagnosis", "followsStandardProtocol", "isExperimental", "isCosmetic"],
      },
      billTotal: { type: Type.NUMBER, description: "Total billed amount in INR" },
    },
    required: ["document", "coverage", "medical", "billTotal"],
  };

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: "Analyze this medical bill/document and extract the required structured information for claims adjudication." },
            { inlineData: { data: fileBuffer.toString("base64"), mimeType } },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema,
        temperature: 0.1,
      },
    });

    const text = response.text;
    if (!text) throw new Error("Empty response from Gemini");

    return JSON.parse(text) as ExtractedBillData;
  } catch (error) {
    console.error("Gemini AI Parsing Error:", error);
    throw new Error("Failed to parse medical bill with AI");
  }
}

function getMockExtractedData(): ExtractedBillData {
  return {
    document: {
      ocrConfidence: 0.95,
      hasPrescription: true,
      prescriptionIsValid: true,
      doctorRegNumber: "MH/12345/2021",
      hasStampAndHeader: true,
      serviceDate: new Date().toISOString().split("T")[0],
      documentDates: [new Date().toISOString().split("T")[0]],
      patientNameOnDoc: "Jane Doe",
    },
    coverage: {
      diagnosisCodes: ["J06.9"],
      procedureCodes: ["99213"],
      serviceCategory: "consultation" as SubLimitCategory,
    },
    medical: {
      diagnosisJustifiesTreatment: true,
      prescriptionMatchesDiagnosis: true,
      followsStandardProtocol: true,
      isExperimental: false,
      isCosmetic: false,
    },
    billTotal: 1500,
  };
}
