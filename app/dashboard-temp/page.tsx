"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface Reading {
  time: string;
  value: number;
  unit: string;
  sensorName: string;
  originalTimestamp: string;
  isCritical?: boolean;
  alertMessage?: string | null;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-2 border border-gray-300 rounded shadow text-black">
        <p className="label">{`Time: ${label}`}</p>
        <p className="intro">{`Value: ${data.value}`}</p>
        <p className="intro">{`Unit: ${data.unit}`}</p>
        <p className="intro">{`Sensor: ${data.sensorName}`}</p>
        {data.isCritical && (
          <p className="text-red-500 font-bold">
            {data.alertMessage || "Critical Value!"}
          </p>
        )}
      </div>
    );
  }
  return null;
};

export default function DashboardTempPage() {
  const [readings, setReadings] = useState<Reading[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const apiUrlRaw = process.env.NEXT_PUBLIC_API_URL;
  // Remove trailing slash if present to avoid double-slash in requests
  const apiUrl = apiUrlRaw ? apiUrlRaw.replace(/\/+$/, "") : "";

  useEffect(() => {
    if (!apiUrl) {
      setError("API URL не визначено. Перевір .env.local");
      setLoading(false);
      return;
    }

    async function fetchData() {
      if (readings.length === 0) setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${apiUrl}/sensors`);
        if (!res.ok) throw new Error(`HTTP помилка: ${res.status}`);
        const data = await res.json();

        if (!Array.isArray(data)) {
          throw new Error("API повернув невірний формат даних");
        }

        const formatted = data.map((item: any) => {
          const isCritical = item.value < 12 || item.value > 55;
          return {
            time: new Date(item.timestamp).toLocaleTimeString("uk-UA", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            }),
            value: item.value,
            unit: item.unit,
            sensorName: item.sensorName,
            originalTimestamp: item.timestamp,
            isCritical,
            alertMessage: isCritical
              ? `Critical temperature, Unit ${item.unit}, ${item.value}`
              : null,
          };
        });

        setReadings(formatted.reverse());
      } catch (err) {
        if (err instanceof Error) setError(err.message);
        else setError("Невідома помилка при отриманні даних");
        console.error("Fetching data error:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
    const interval = setInterval(fetchData, 10000);

    return () => clearInterval(interval);
  }, [apiUrl]);

  useEffect(() => {
    if (!apiUrl) return;
    const eventSource = new EventSource(`${apiUrl}/sensors/sse`);

    eventSource.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        const item = parsed.data;
        const newReading: Reading = {
          time: new Date(item.timestamp).toLocaleTimeString("uk-UA", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }),
          value: item.value,
          unit: item.unit,
          sensorName: item.sensorName,
          originalTimestamp: item.timestamp,
          isCritical: item.isCritical,
          alertMessage: item.alertMessage,
        };
        setReadings((prev) => [...prev, newReading]);
      } catch (e) {
        console.error("SSE Parse Error", e);
      }
    };

    eventSource.onerror = (e) => {
      console.error("SSE Error", e);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [apiUrl]);

  if (loading) return <p>Завантаження даних...</p>;
  if (error) return <p className="text-red-500">Помилка: {error}</p>;

  return (
    <div className="w-full h-96">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={readings}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="time" />
          <YAxis />
          <Tooltip content={<CustomTooltip />} />
          <Line type="monotone" dataKey="value" stroke="#8884d8" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
