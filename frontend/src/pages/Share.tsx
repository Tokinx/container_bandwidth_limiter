import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { publicApi } from '@/lib/api';
import { formatBytes, formatDate, getStatusText } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Share() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      publicApi
        .getShareInfo(token)
        .then((response) => {
          setData(response.data);
        })
        .catch((err) => {
          setError(err.response?.data?.error || '加载失败');
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>加载中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>错误</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  const usagePercent = data.bandwidth.total_limit > 0
    ? (data.bandwidth.used / data.bandwidth.total_limit) * 100
    : 0;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{data.name}</CardTitle>
            <p className="text-muted-foreground">容器使用情况</p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="font-semibold mb-3">基本信息</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">状态</p>
                  <p className="font-medium">{getStatusText(data.status)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">到期时间</p>
                  <p className="font-medium">{formatDate(data.expire_at)}</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-3">流量使用</h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm text-muted-foreground">已用流量</p>
                  <p className="text-xl font-bold">{formatBytes(data.bandwidth.used)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">剩余流量</p>
                  <p className="text-xl font-bold">{formatBytes(data.bandwidth.remaining)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">流量限制</p>
                  <p className="font-medium">
                    {data.bandwidth.limit ? formatBytes(data.bandwidth.total_limit) : '无限制'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">重置日期</p>
                  <p className="font-medium">每月 {data.reset_day} 日</p>
                </div>
              </div>

              {data.bandwidth.limit && (
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>使用率</span>
                    <span>{usagePercent.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full ${
                        usagePercent > 90 ? 'bg-red-500' : usagePercent > 70 ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(usagePercent, 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {data.memory && (
              <div>
                <h3 className="font-semibold mb-3">内存使用</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">当前使用</p>
                    <p className="font-medium">{formatBytes(data.memory.usage)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">内存限制</p>
                    <p className="font-medium">{formatBytes(data.memory.limit)}</p>
                  </div>
                </div>
              </div>
            )}

            {data.network && (
              <div>
                <h3 className="font-semibold mb-3">网络统计</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">接收</p>
                    <p className="font-medium">{formatBytes(data.network.rx_bytes)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">发送</p>
                    <p className="font-medium">{formatBytes(data.network.tx_bytes)}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="text-xs text-muted-foreground text-center pt-4 border-t">
              上次重置: {formatDate(data.last_reset_at)}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
