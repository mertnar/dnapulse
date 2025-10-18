{{/*
Expand the name of the chart.
*/}}
{{- define "mini-dna-platform.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "mini-dna-platform.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "mini-dna-platform.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "mini-dna-platform.labels" -}}
helm.sh/chart: {{ include "mini-dna-platform.chart" . }}
{{ include "mini-dna-platform.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "mini-dna-platform.selectorLabels" -}}
app.kubernetes.io/name: {{ include "mini-dna-platform.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "mini-dna-platform.serviceAccountName" -}}
{{- if .Values.security.serviceAccount.create }}
{{- default (include "mini-dna-platform.fullname" .) .Values.security.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.security.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Create the image name for a service
*/}}
{{- define "mini-dna-platform.serviceImage" -}}
{{- $registry := .Values.global.imageRegistry -}}
{{- $service := .service -}}
{{- $repository := index .Values.services $service "image" "repository" -}}
{{- $tag := index .Values.services $service "image" "tag" -}}
{{- printf "%s/%s:%s" $registry $repository $tag -}}
{{- end }}

{{/*
Create environment variables for a service
*/}}
{{- define "mini-dna-platform.serviceEnv" -}}
{{- $service := .service -}}
{{- range $key, $value := (index .Values.services $service "env") }}
- name: {{ $key }}
  value: {{ $value | quote }}
{{- end }}
{{- end }}

{{/*
Create resource limits and requests
*/}}
{{- define "mini-dna-platform.serviceResources" -}}
{{- $service := .service -}}
{{- $resources := index .Values.services $service "resources" -}}
{{- if $resources }}
resources:
  {{- toYaml $resources | nindent 2 }}
{{- end }}
{{- end }}

{{/*
Create service ports
*/}}
{{- define "mini-dna-platform.servicePorts" -}}
{{- $service := .service -}}
{{- $serviceConfig := index .Values.services $service -}}
{{- $metricsEnabled := index $serviceConfig "metrics" "enabled" -}}
- port: {{ $serviceConfig.service.port }}
  targetPort: {{ $serviceConfig.service.targetPort | default $serviceConfig.service.port }}
  protocol: TCP
  name: http
{{- if $metricsEnabled }}
- port: {{ $serviceConfig.metrics.port }}
  targetPort: {{ $serviceConfig.metrics.port }}
  protocol: TCP
  name: metrics
{{- end }}
{{- end }}

{{/*
Create annotations for Prometheus scraping
*/}}
{{- define "mini-dna-platform.prometheusAnnotations" -}}
{{- $service := .service -}}
{{- $serviceConfig := index .Values.services $service -}}
{{- $metricsEnabled := index $serviceConfig "metrics" "enabled" -}}
{{- if $metricsEnabled }}
prometheus.io/scrape: "true"
prometheus.io/port: "{{ $serviceConfig.metrics.port }}"
prometheus.io/path: "{{ $serviceConfig.metrics.path }}"
{{- end }}
{{- end }}
