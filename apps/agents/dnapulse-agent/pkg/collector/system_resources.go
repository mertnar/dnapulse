package collector

import (
	"bufio"
	"fmt"
	"os"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
	"time"
)

// SystemMetrics represents comprehensive system metrics
type SystemMetrics struct {
	Timestamp    time.Time     `json:"timestamp"`
	CPU          CPUMetrics    `json:"cpu"`
	Memory       MemoryMetrics `json:"memory"`
	Disk         []DiskMetrics `json:"disk"`
	GPU          *GPUMetrics   `json:"gpu,omitempty"` // Optional
	TopProcesses []ProcessInfo `json:"top_processes"`
	LoadAverage  LoadAverage   `json:"load_average"`
	Uptime       float64       `json:"uptime_seconds"`
	BootTime     time.Time     `json:"boot_time"`
}

// CPUMetrics represents CPU usage statistics
type CPUMetrics struct {
	UsagePercent  float64   `json:"usage_percent"`
	CoreCount     int       `json:"core_count"`
	PerCoreUsage  []float64 `json:"per_core_usage"`
	UserPercent   float64   `json:"user_percent"`
	SystemPercent float64   `json:"system_percent"`
	IdlePercent   float64   `json:"idle_percent"`
	IOWaitPercent float64   `json:"iowait_percent"`
}

// MemoryMetrics represents memory usage statistics
type MemoryMetrics struct {
	TotalBytes     uint64  `json:"total_bytes"`
	UsedBytes      uint64  `json:"used_bytes"`
	FreeBytes      uint64  `json:"free_bytes"`
	AvailableBytes uint64  `json:"available_bytes"`
	UsagePercent   float64 `json:"usage_percent"`
	SwapTotal      uint64  `json:"swap_total_bytes"`
	SwapUsed       uint64  `json:"swap_used_bytes"`
	SwapFree       uint64  `json:"swap_free_bytes"`
}

// DiskMetrics represents disk usage statistics
type DiskMetrics struct {
	MountPoint   string  `json:"mount_point"`
	Device       string  `json:"device"`
	TotalBytes   uint64  `json:"total_bytes"`
	UsedBytes    uint64  `json:"used_bytes"`
	FreeBytes    uint64  `json:"free_bytes"`
	UsagePercent float64 `json:"usage_percent"`
	Filesystem   string  `json:"filesystem"`
}

// GPUMetrics represents GPU usage statistics (NVIDIA GPUs)
type GPUMetrics struct {
	Available      bool    `json:"available"`
	Name           string  `json:"name,omitempty"`
	Driver         string  `json:"driver_version,omitempty"`
	MemoryTotal    uint64  `json:"memory_total_mb,omitempty"`
	MemoryUsed     uint64  `json:"memory_used_mb,omitempty"`
	MemoryFree     uint64  `json:"memory_free_mb,omitempty"`
	GPUUtilization float64 `json:"gpu_utilization_percent,omitempty"`
	Temperature    float64 `json:"temperature_celsius,omitempty"`
}

// ProcessInfo represents a single process information
type ProcessInfo struct {
	PID           int     `json:"pid"`
	Name          string  `json:"name"`
	User          string  `json:"user"`
	CPUPercent    float64 `json:"cpu_percent"`
	MemoryPercent float64 `json:"memory_percent"`
	MemoryBytes   uint64  `json:"memory_bytes"`
	Status        string  `json:"status"`
	CommandLine   string  `json:"command_line"`
}

// LoadAverage represents system load averages
type LoadAverage struct {
	Load1  float64 `json:"load_1min"`
	Load5  float64 `json:"load_5min"`
	Load15 float64 `json:"load_15min"`
}

// CollectSystemMetrics collects comprehensive system metrics
func CollectSystemMetrics() (*SystemMetrics, error) {
	metrics := &SystemMetrics{
		Timestamp: time.Now().UTC(),
	}

	// Collect CPU metrics
	cpu, err := collectCPUMetrics()
	if err != nil {
		return nil, fmt.Errorf("failed to collect CPU metrics: %w", err)
	}
	metrics.CPU = cpu

	// Collect Memory metrics
	mem, err := collectMemoryMetrics()
	if err != nil {
		return nil, fmt.Errorf("failed to collect memory metrics: %w", err)
	}
	metrics.Memory = mem

	// Collect Disk metrics
	disks, err := collectDiskMetrics()
	if err != nil {
		return nil, fmt.Errorf("failed to collect disk metrics: %w", err)
	}
	metrics.Disk = disks

	// Collect GPU metrics (optional - don't fail if unavailable)
	gpu := collectGPUMetrics()
	if gpu != nil && gpu.Available {
		metrics.GPU = gpu
	}

	// Collect top processes
	procs, err := collectTopProcesses(10)
	if err != nil {
		return nil, fmt.Errorf("failed to collect processes: %w", err)
	}
	metrics.TopProcesses = procs

	// Load average
	load, err := collectLoadAverage()
	if err != nil {
		return nil, fmt.Errorf("failed to collect load average: %w", err)
	}
	metrics.LoadAverage = load

	// Uptime
	uptime, bootTime, err := collectUptimeInfo()
	if err != nil {
		return nil, fmt.Errorf("failed to collect uptime: %w", err)
	}
	metrics.Uptime = uptime
	metrics.BootTime = bootTime

	return metrics, nil
}

// collectCPUMetrics reads /proc/stat for Linux
func collectCPUMetrics() (CPUMetrics, error) {
	file, err := os.Open("/proc/stat")
	if err != nil {
		return CPUMetrics{}, err
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	metrics := CPUMetrics{
		CoreCount: runtime.NumCPU(),
	}

	// Read first line (aggregate CPU stats)
	if scanner.Scan() {
		line := scanner.Text()
		if !strings.HasPrefix(line, "cpu ") {
			return CPUMetrics{}, fmt.Errorf("unexpected /proc/stat format")
		}

		fields := strings.Fields(line)
		if len(fields) < 8 {
			return CPUMetrics{}, fmt.Errorf("not enough CPU fields")
		}

		// Parse values: user, nice, system, idle, iowait, irq, softirq, steal
		user, _ := strconv.ParseUint(fields[1], 10, 64)
		nice, _ := strconv.ParseUint(fields[2], 10, 64)
		system, _ := strconv.ParseUint(fields[3], 10, 64)
		idle, _ := strconv.ParseUint(fields[4], 10, 64)
		iowait, _ := strconv.ParseUint(fields[5], 10, 64)
		irq, _ := strconv.ParseUint(fields[6], 10, 64)
		softirq, _ := strconv.ParseUint(fields[7], 10, 64)

		total := user + nice + system + idle + iowait + irq + softirq
		if total > 0 {
			metrics.UserPercent = float64(user+nice) / float64(total) * 100
			metrics.SystemPercent = float64(system+irq+softirq) / float64(total) * 100
			metrics.IdlePercent = float64(idle) / float64(total) * 100
			metrics.IOWaitPercent = float64(iowait) / float64(total) * 100
			metrics.UsagePercent = 100 - metrics.IdlePercent
		}
	}

	return metrics, nil
}

// collectMemoryMetrics reads /proc/meminfo for Linux
func collectMemoryMetrics() (MemoryMetrics, error) {
	file, err := os.Open("/proc/meminfo")
	if err != nil {
		return MemoryMetrics{}, err
	}
	defer file.Close()

	metrics := MemoryMetrics{}
	scanner := bufio.NewScanner(file)

	for scanner.Scan() {
		line := scanner.Text()
		fields := strings.Fields(line)
		if len(fields) < 2 {
			continue
		}

		key := strings.TrimSuffix(fields[0], ":")
		value, _ := strconv.ParseUint(fields[1], 10, 64)
		value *= 1024 // Convert from KB to bytes

		switch key {
		case "MemTotal":
			metrics.TotalBytes = value
		case "MemFree":
			metrics.FreeBytes = value
		case "MemAvailable":
			metrics.AvailableBytes = value
		case "SwapTotal":
			metrics.SwapTotal = value
		case "SwapFree":
			metrics.SwapFree = value
		}
	}

	if metrics.TotalBytes > 0 {
		metrics.UsedBytes = metrics.TotalBytes - metrics.FreeBytes
		metrics.UsagePercent = float64(metrics.UsedBytes) / float64(metrics.TotalBytes) * 100
		metrics.SwapUsed = metrics.SwapTotal - metrics.SwapFree
	}

	return metrics, scanner.Err()
}

// collectDiskMetrics executes df command
func collectDiskMetrics() ([]DiskMetrics, error) {
	cmd := exec.Command("df", "-B1", "-T")
	output, err := cmd.Output()
	if err != nil {
		return nil, err
	}

	var disks []DiskMetrics
	lines := strings.Split(string(output), "\n")

	for i, line := range lines {
		if i == 0 || line == "" {
			continue // Skip header
		}

		fields := strings.Fields(line)
		if len(fields) < 7 {
			continue
		}

		// Filter out pseudo filesystems
		filesystem := fields[1]
		if filesystem == "tmpfs" || filesystem == "devtmpfs" || filesystem == "squashfs" {
			continue
		}

		total, _ := strconv.ParseUint(fields[2], 10, 64)
		used, _ := strconv.ParseUint(fields[3], 10, 64)
		free, _ := strconv.ParseUint(fields[4], 10, 64)

		var usagePercent float64
		if total > 0 {
			usagePercent = float64(used) / float64(total) * 100
		}

		disks = append(disks, DiskMetrics{
			Device:       fields[0],
			Filesystem:   filesystem,
			TotalBytes:   total,
			UsedBytes:    used,
			FreeBytes:    free,
			UsagePercent: usagePercent,
			MountPoint:   fields[6],
		})
	}

	return disks, nil
}

// collectGPUMetrics tries nvidia-smi (optional)
func collectGPUMetrics() *GPUMetrics {
	cmd := exec.Command("nvidia-smi",
		"--query-gpu=name,driver_version,memory.total,memory.used,memory.free,utilization.gpu,temperature.gpu",
		"--format=csv,noheader,nounits")

	output, err := cmd.Output()
	if err != nil {
		// GPU not available or nvidia-smi not installed
		return &GPUMetrics{Available: false}
	}

	line := strings.TrimSpace(string(output))
	fields := strings.Split(line, ", ")

	if len(fields) < 7 {
		return &GPUMetrics{Available: false}
	}

	memTotal, _ := strconv.ParseUint(fields[2], 10, 64)
	memUsed, _ := strconv.ParseUint(fields[3], 10, 64)
	memFree, _ := strconv.ParseUint(fields[4], 10, 64)
	gpuUtil, _ := strconv.ParseFloat(fields[5], 64)
	temp, _ := strconv.ParseFloat(fields[6], 64)

	return &GPUMetrics{
		Available:      true,
		Name:           fields[0],
		Driver:         fields[1],
		MemoryTotal:    memTotal,
		MemoryUsed:     memUsed,
		MemoryFree:     memFree,
		GPUUtilization: gpuUtil,
		Temperature:    temp,
	}
}

// collectTopProcesses executes ps and sorts by CPU/Memory
func collectTopProcesses(limit int) ([]ProcessInfo, error) {
	cmd := exec.Command("ps", "aux", "--sort=-%cpu")
	output, err := cmd.Output()
	if err != nil {
		return nil, err
	}

	var processes []ProcessInfo
	lines := strings.Split(string(output), "\n")

	for i, line := range lines {
		if i == 0 || line == "" || len(processes) >= limit {
			continue
		}

		fields := strings.Fields(line)
		if len(fields) < 11 {
			continue
		}

		pid, _ := strconv.Atoi(fields[1])
		cpuPercent, _ := strconv.ParseFloat(fields[2], 64)
		memPercent, _ := strconv.ParseFloat(fields[3], 64)

		processes = append(processes, ProcessInfo{
			PID:           pid,
			User:          fields[0],
			CPUPercent:    cpuPercent,
			MemoryPercent: memPercent,
			Status:        fields[7],
			Name:          fields[10],
			CommandLine:   strings.Join(fields[10:], " "),
		})
	}

	return processes, nil
}

// collectLoadAverage reads /proc/loadavg for Linux
func collectLoadAverage() (LoadAverage, error) {
	data, err := os.ReadFile("/proc/loadavg")
	if err != nil {
		return LoadAverage{}, err
	}

	fields := strings.Fields(string(data))
	if len(fields) < 3 {
		return LoadAverage{}, fmt.Errorf("unexpected /proc/loadavg format")
	}

	load1, _ := strconv.ParseFloat(fields[0], 64)
	load5, _ := strconv.ParseFloat(fields[1], 64)
	load15, _ := strconv.ParseFloat(fields[2], 64)

	return LoadAverage{
		Load1:  load1,
		Load5:  load5,
		Load15: load15,
	}, nil
}

// collectUptimeInfo reads /proc/uptime
func collectUptimeInfo() (float64, time.Time, error) {
	data, err := os.ReadFile("/proc/uptime")
	if err != nil {
		return 0, time.Time{}, err
	}

	fields := strings.Fields(string(data))
	if len(fields) < 1 {
		return 0, time.Time{}, fmt.Errorf("unexpected /proc/uptime format")
	}

	uptime, err := strconv.ParseFloat(fields[0], 64)
	if err != nil {
		return 0, time.Time{}, err
	}

	bootTime := time.Now().Add(-time.Duration(uptime) * time.Second)

	return uptime, bootTime, nil
}
