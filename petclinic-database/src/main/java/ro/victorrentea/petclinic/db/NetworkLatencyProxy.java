package ro.victorrentea.petclinic.db;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.SocketException;
import java.util.concurrent.TimeUnit;

/**
 * Forwards bytes between a TCP client and a remote server, sleeping {@code delayMillis}
 * after each write to emulate network latency.
 */
public class NetworkLatencyProxy {
  private final String remoteHost;
  private final int remotePort;
  private final int port;
  private final int delayMillis;
  private volatile ServerSocket serverSocket;

  public NetworkLatencyProxy(String remoteHost, int remotePort, int port, int delayMillis) {
    this.remoteHost = remoteHost;
    this.remotePort = remotePort;
    this.port = port;
    this.delayMillis = delayMillis;
  }

  /** Binds the listening port synchronously, then accepts connections on a background daemon thread. */
  public void start() throws IOException {
    this.serverSocket = new ServerSocket(port);
    System.out.println("Proxying :" + port + " → " + remoteHost + ":" + remotePort + " (delay " + delayMillis + "ms)");
    Thread acceptor = new Thread(this::acceptLoop, "latency-proxy-acceptor");
    acceptor.setDaemon(true);
    acceptor.start();
  }

  public void stop() throws IOException {
    if (serverSocket != null && !serverSocket.isClosed()) {
      serverSocket.close();
    }
  }

  private void acceptLoop() {
    try {
      while (!serverSocket.isClosed()) {
        Socket socket = serverSocket.accept();
        Thread t = new Thread(new ProxyConnection(socket), "latency-proxy-conn");
        t.setDaemon(true);
        t.start();
      }
    } catch (SocketException ignored) {
    } catch (IOException e) {
      throw new RuntimeException(e);
    }
  }

  private class ProxyConnection implements Runnable {
    private final Socket clientSocket;
    private Socket serverConnection;

    ProxyConnection(Socket clientSocket) {
      this.clientSocket = clientSocket;
    }

    @Override
    public void run() {
      try {
        serverConnection = new Socket(remoteHost, remotePort);
      } catch (IOException e) {
        e.printStackTrace();
        return;
      }
      Thread t1 = new Thread(new CopyDataTask(clientSocket, serverConnection), "proxy-c2s");
      Thread t2 = new Thread(new CopyDataTask(serverConnection, clientSocket), "proxy-s2c");
      t1.setDaemon(true);
      t2.setDaemon(true);
      t1.start();
      t2.start();
    }
  }

  private class CopyDataTask implements Runnable {
    private final Socket in;
    private final Socket out;

    CopyDataTask(Socket in, Socket out) {
      this.in = in;
      this.out = out;
    }

    @Override
    public void run() {
      try {
        InputStream inputStream = in.getInputStream();
        OutputStream outputStream = out.getOutputStream();
        byte[] buf = new byte[40960];
        int bytesRead;
        while (-1 != (bytesRead = inputStream.read(buf))) {
          outputStream.write(buf, 0, bytesRead);
          TimeUnit.MILLISECONDS.sleep(delayMillis);
        }
      } catch (SocketException ignored) {
      } catch (Exception e) {
        e.printStackTrace();
      } finally {
        try {
          in.close();
        } catch (IOException ignored) {
        }
      }
    }
  }
}
