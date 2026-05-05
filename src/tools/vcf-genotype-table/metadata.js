import { vcfMetadataColumns } from "../../core/vcf-genotype-table.js";

export const vcfGenotypeTableMetadata = {
  id: "vcf-genotype-table",
  name: "VCF Extractor",
  category: "Analyze Tables",
  tags: ["table", "format conversion", "workflow"],
  summary: "Extract VCF metadata, sample names, variant fields, or sample genotype fields into tables.",
  inputType: "VCF text",
  outputType: "VCF TSV table or report",
  workflow: {
    inputs: [{ id: "input", kind: "text", mediaType: "text/plain" }],
    outputs: [
      { id: "primary", kind: "text", mediaType: "text/plain" },
      { id: "report", kind: "text", mediaType: "text/plain" },
      { id: "table", kind: "table", schema: "vcf-extractor", columns: vcfMetadataColumns },
      { id: "warnings", kind: "warnings" }
    ]
  },
  runInWorker: true,
  workerModule: "../tools/vcf-genotype-table/run.js",
  workerExport: "runVcfGenotypeTable",
  options: [
    {
      id: "dataType",
      type: "radio",
      label: "Data to extract",
      defaultValue: "metadata",
      choices: [
        { value: "metadata", label: "Metadata lines" },
        { value: "samples", label: "Sample names" },
        { value: "variants", label: "Variant fields" },
        { value: "genotypes", label: "Sample genotypes" }
      ]
    },
    {
      type: "group",
      label: "Output format",
      options: [
        {
          id: "outputFormat",
          type: "radio",
          label: "Format",
          defaultValue: "tsv",
          choices: [
            { value: "tsv", label: "TSV table" },
            { value: "report", label: "Summary report" }
          ]
        }
      ]
    }
  ]
};
